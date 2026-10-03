#!/usr/bin/env python3
"""Generate synthetic finance data for the Close Agent MCP demo.

All data is synthetic. Planted anomalies give the agent something real to find:
- duplicate accrual on Accrued Expenses
- balance-sheet reclass between Prepaid and Other Current Assets
- revenue timing swing (deferred vs recognized)
"""

from __future__ import annotations

import argparse
import json
import random
import sqlite3
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "finance.db"
EXPORT_DIR = ROOT / "exports"
SEED = 42

ENTITIES = ["US-01", "US-02", "EMEA-01"]
ACCOUNTS = [
    ("1000", "Cash", "Asset", "BS"),
    ("1100", "Accounts Receivable", "Asset", "BS"),
    ("1200", "Prepaid Expenses", "Asset", "BS"),
    ("1250", "Other Current Assets", "Asset", "BS"),
    ("2000", "Accounts Payable", "Liability", "BS"),
    ("2100", "Accrued Expenses", "Liability", "BS"),
    ("2200", "Deferred Revenue", "Liability", "BS"),
    ("4000", "Product Revenue", "Revenue", "PL"),
    ("4100", "Services Revenue", "Revenue", "PL"),
    ("5000", "Cost of Goods Sold", "Expense", "PL"),
    ("6000", "Salaries & Wages", "Expense", "PL"),
    ("6100", "Professional Fees", "Expense", "PL"),
    ("6200", "Travel & Entertainment", "Expense", "PL"),
    ("7000", "Cloud Infrastructure", "Expense", "PL"),
]

CUSTOMERS = [
    ("C-100", "Northwind Analytics", "US"),
    ("C-101", "Helios Retail Group", "US"),
    ("C-102", "Atlas Manufacturing", "DE"),
    ("C-103", "Blue Harbor Logistics", "UK"),
    ("C-104", "Cascade Health Systems", "US"),
]

VENDORS = [
    ("V-200", "Apex Cloud Services", "US"),
    ("V-201", "Ledger Legal LLP", "US"),
    ("V-202", "Summit Facilities Co", "US"),
    ("V-203", "Orbit Travel Desk", "IE"),
    ("V-204", "Prime Temp Staffing", "US"),
]


@dataclass
class PlantedAnomaly:
    id: str
    account: str
    period: str
    kind: str
    explanation: str
    expected_citations: list[str]


def month_starts(n: int = 24, end: date | None = None) -> list[date]:
    end = end or date(2026, 9, 1)
    year, month = end.year, end.month
    out: list[date] = []
    for _ in range(n):
        out.append(date(year, month, 1))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    return list(reversed(out))


def period_label(d: date) -> str:
    return d.strftime("%Y-%m")


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        DROP TABLE IF EXISTS tool_call_log;
        DROP TABLE IF EXISTS review_queue;
        DROP TABLE IF EXISTS close_tasks;
        DROP TABLE IF EXISTS subledger;
        DROP TABLE IF EXISTS trial_balance;
        DROP TABLE IF EXISTS accounts;
        DROP TABLE IF EXISTS parties;
        DROP TABLE IF EXISTS anomalies;
        DROP TABLE IF EXISTS meta;

        CREATE TABLE meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE accounts (
            account_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            account_type TEXT NOT NULL,
            statement TEXT NOT NULL
        );

        CREATE TABLE parties (
            party_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            party_type TEXT NOT NULL,
            country TEXT NOT NULL
        );

        CREATE TABLE trial_balance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            period TEXT NOT NULL,
            entity TEXT NOT NULL,
            account_id TEXT NOT NULL,
            ending_balance REAL NOT NULL,
            UNIQUE(period, entity, account_id)
        );

        CREATE TABLE subledger (
            txn_id TEXT PRIMARY KEY,
            period TEXT NOT NULL,
            entity TEXT NOT NULL,
            account_id TEXT NOT NULL,
            txn_date TEXT NOT NULL,
            party_id TEXT,
            memo TEXT NOT NULL,
            amount REAL NOT NULL,
            source_system TEXT NOT NULL
        );

        CREATE TABLE close_tasks (
            task_id TEXT PRIMARY KEY,
            period TEXT NOT NULL,
            entity TEXT NOT NULL,
            title TEXT NOT NULL,
            owner TEXT NOT NULL,
            status TEXT NOT NULL,
            due_day INTEGER NOT NULL
        );

        CREATE TABLE anomalies (
            anomaly_id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            period TEXT NOT NULL,
            kind TEXT NOT NULL,
            explanation TEXT NOT NULL,
            expected_citations TEXT NOT NULL
        );

        CREATE TABLE review_queue (
            item_id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            period TEXT NOT NULL,
            entity TEXT NOT NULL,
            variance_pct REAL NOT NULL,
            variance_amt REAL NOT NULL,
            draft_commentary TEXT NOT NULL,
            confidence REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            edited_commentary TEXT,
            reviewer_note TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE tool_call_log (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            tool_name TEXT NOT NULL,
            arguments TEXT NOT NULL,
            result_summary TEXT NOT NULL
        );
        """
    )


def base_balance(account_id: str, entity_idx: int, month_idx: int) -> float:
    """Stable-ish synthetic ending balances with mild growth."""
    rng = random.Random(hash((account_id, entity_idx)) % (2**32))
    scale = 1.0 + entity_idx * 0.35
    growth = 1.0 + month_idx * 0.012
    centers = {
        "1000": 2_400_000,
        "1100": 1_850_000,
        "1200": 320_000,
        "1250": 180_000,
        "2000": -940_000,
        "2100": -410_000,
        "2200": -620_000,
        "4000": -3_200_000,
        "4100": -980_000,
        "5000": 1_450_000,
        "6000": 1_100_000,
        "6100": 240_000,
        "6200": 95_000,
        "7000": 310_000,
    }
    noise = rng.uniform(0.92, 1.08)
    return round(centers[account_id] * scale * growth * noise, 2)


def plant_anomalies(
    balances: dict[tuple[str, str, str], float],
    periods: list[str],
    entity: str = "US-01",
) -> list[PlantedAnomaly]:
    """Mutate balances and return known anomaly explanations for evals."""
    # Use the latest closed period (last month) vs prior for demo focus.
    period = periods[-1]
    prior = periods[-2]
    anomalies: list[PlantedAnomaly] = []

    # 1) Duplicate accrual on Accrued Expenses (2100) — liability more negative.
    key = (period, entity, "2100")
    balances[key] = balances[key] - 185_000
    anomalies.append(
        PlantedAnomaly(
            id="ANOM-DUP-ACCRUAL",
            account="2100",
            period=period,
            kind="duplicate_accrual",
            explanation=(
                "Duplicate legal accrual posted twice for Ledger Legal LLP "
                "($185K). Prior period had a single accrual; current period "
                "includes JE-ACC-4401 and JE-ACC-4401-DUP."
            ),
            expected_citations=["JE-ACC-4401", "JE-ACC-4401-DUP", "V-201"],
        )
    )

    # 2) Reclass: Prepaid (1200) down, Other Current Assets (1250) up by $92K.
    balances[(period, entity, "1200")] = balances[(period, entity, "1200")] - 92_000
    balances[(period, entity, "1250")] = balances[(period, entity, "1250")] + 92_000
    anomalies.append(
        PlantedAnomaly(
            id="ANOM-RECLASS",
            account="1200",
            period=period,
            kind="reclass",
            explanation=(
                "Reclass of software prepaid to Other Current Assets ($92K) via "
                "JE-RCL-8810. Net BS impact is zero; Prepaid variance is timing/"
                "classification, not cash spend."
            ),
            expected_citations=["JE-RCL-8810", "1200", "1250"],
        )
    )

    # 3) Revenue timing swing: Product Revenue (4000) more negative (higher revenue)
    # and Deferred Revenue (2200) less negative — pulled forward recognition.
    # Soften prior and enlarge current so MoM clears the 10% dual threshold.
    balances[(prior, entity, "4000")] = balances[(prior, entity, "4000")] + 420_000
    balances[(period, entity, "4000")] = balances[(period, entity, "4000")] - 520_000
    balances[(period, entity, "2200")] = balances[(period, entity, "2200")] + 520_000
    anomalies.append(
        PlantedAnomaly(
            id="ANOM-REV-TIMING",
            account="4000",
            period=period,
            kind="revenue_timing",
            explanation=(
                "Revenue timing pull-forward for Northwind Analytics annual "
                "renewal ($520K) recognized from Deferred Revenue via "
                "JE-REV-2207. Creates >10% MoM swing vs prior period."
            ),
            expected_citations=["JE-REV-2207", "C-100", "2200"],
        )
    )

    return anomalies


def build_subledger(
    periods: list[str],
    entity: str,
    anomalies: list[PlantedAnomaly],
) -> list[tuple]:
    rng = random.Random(SEED + 7)
    rows: list[tuple] = []
    period = periods[-1]
    prior = periods[-2]
    day0 = date.fromisoformat(f"{period}-01")

    def add(
        txn_id: str,
        acct: str,
        offset: int,
        party: str | None,
        memo: str,
        amount: float,
        source: str,
        per: str | None = None,
    ) -> None:
        d = day0 + timedelta(days=offset)
        rows.append(
            (
                txn_id,
                per or period,
                entity,
                acct,
                d.isoformat(),
                party,
                memo,
                round(amount, 2),
                source,
            )
        )

    # Routine AR activity
    for i, (cid, cname, _) in enumerate(CUSTOMERS):
        add(
            f"AR-{period}-{i+1:03d}",
            "1100",
            2 + i,
            cid,
            f"Invoice {cname} — monthly services",
            rng.uniform(40_000, 120_000),
            "NetSuite",
        )

    # Planted: duplicate accrual
    add(
        "JE-ACC-4401",
        "2100",
        8,
        "V-201",
        "Legal accrual — Q3 matter Ledger Legal LLP",
        -185_000,
        "Manual JE",
    )
    add(
        "JE-ACC-4401-DUP",
        "2100",
        9,
        "V-201",
        "Legal accrual — Q3 matter Ledger Legal LLP (duplicate)",
        -185_000,
        "Manual JE",
    )

    # Planted: reclass
    add(
        "JE-RCL-8810",
        "1200",
        11,
        "V-200",
        "Reclass software prepaid → Other Current Assets",
        -92_000,
        "Manual JE",
    )
    add(
        "JE-RCL-8810-B",
        "1250",
        11,
        "V-200",
        "Reclass software prepaid → Other Current Assets",
        92_000,
        "Manual JE",
    )

    # Planted: revenue timing
    add(
        "JE-REV-2207",
        "4000",
        14,
        "C-100",
        "Recognize Northwind annual renewal from deferred",
        -520_000,
        "Manual JE",
    )
    add(
        "JE-REV-2207-B",
        "2200",
        14,
        "C-100",
        "Relieve deferred revenue — Northwind renewal",
        520_000,
        "Manual JE",
    )

    # Benign prior-period noise for contrast
    add(
        f"JE-PAY-{prior}-01",
        "6000",
        -20,
        "V-204",
        "Temp staffing — close support",
        48_500,
        "Workday",
        per=prior,
    )
    add(
        f"JE-CLOUD-{period}-01",
        "7000",
        5,
        "V-200",
        "Apex Cloud — production usage",
        62_400,
        "Apex",
    )

    # Keep anomaly list referenced so callers can assert coverage
    assert anomalies
    return rows


def build_close_tasks(period: str) -> list[tuple]:
    return [
        (f"T-{period}-01", period, "US-01", "Post payroll accrual", "Close lead", "done", 1),
        (f"T-{period}-02", period, "US-01", "Flux accounts >10% / >$50K", "FP&A", "in_progress", 2),
        (f"T-{period}-03", period, "US-01", "AR subledger tie-out", "AR lead", "in_progress", 2),
        (f"T-{period}-04", period, "US-01", "Review manual JEs >$100K", "Controller", "open", 3),
        (f"T-{period}-05", period, "US-01", "Deferred revenue rollforward", "Revenue", "open", 3),
        (f"T-{period}-06", period, "EMEA-01", "Intercompany confirmations", "EMEA close", "open", 4),
    ]


def build_eval_set(anomalies: list[PlantedAnomaly], periods: list[str]) -> list[dict]:
    """15–20 variance cases with known explanations for scoring."""
    period = periods[-1]
    prior = periods[-2]
    cases: list[dict] = []

    for a in anomalies:
        cases.append(
            {
                "case_id": a.id,
                "account_id": a.account,
                "period_a": prior,
                "period_b": period,
                "entity": "US-01",
                "kind": a.kind,
                "gold_explanation": a.explanation,
                "must_cite": a.expected_citations,
                "threshold_pct": 0.10,
                "threshold_amt": 50_000,
            }
        )

    # Additional benign / distractor cases with known "no material issue" labels
    benign = [
        ("6000", "Headcount-driven salary run-rate; no unusual JEs."),
        ("7000", "Cloud usage within seasonal band; Apex invoice matches subledger."),
        ("5000", "COGS tracks product revenue mix; no cut-off exceptions."),
        ("1100", "AR growth from billed renewals; collections aging stable."),
        ("2000", "AP timing around month-end receipt cutoff."),
        ("6100", "Professional fees flat MoM after Q2 project close."),
        ("6200", "T&E under threshold; no policy exceptions flagged."),
        ("4100", "Services revenue steady; no pull-forwards."),
        ("1000", "Cash movement matches treasury flash; no recon items."),
        ("1250", "Increase fully explained by Prepaid reclass JE-RCL-8810."),
        ("2200", "Decrease from Northwind recognition JE-REV-2207."),
        ("2100", "Includes duplicate accrual JE-ACC-4401-DUP — needs reversal."),
        ("1200", "Decrease from reclass out to 1250; not a cash spend."),
        ("4000", "MoM swing from deferred pull-forward JE-REV-2207."),
        ("5000", "No anomaly — variance below dual threshold in US-02."),
        ("6100", "No anomaly — EMEA professional fees within band."),
    ]
    for i, (acct, expl) in enumerate(benign, start=1):
        cases.append(
            {
                "case_id": f"EVAL-BENIGN-{i:02d}",
                "account_id": acct,
                "period_a": prior,
                "period_b": period,
                "entity": "US-01" if i <= 14 else "US-02",
                "kind": "known_driver" if i <= 14 else "below_threshold",
                "gold_explanation": expl,
                "must_cite": [],
                "threshold_pct": 0.10,
                "threshold_amt": 50_000,
            }
        )

    return cases[:20]


def generate(db_path: Path = DB_PATH) -> dict:
    random.seed(SEED)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()

    periods = [period_label(d) for d in month_starts(24)]
    conn = sqlite3.connect(db_path)
    ensure_schema(conn)

    conn.execute(
        "INSERT INTO meta(key, value) VALUES (?, ?)",
        ("disclaimer", "SYNTHETIC DATA — not real company financials"),
    )
    conn.execute(
        "INSERT INTO meta(key, value) VALUES (?, ?)",
        ("seed", str(SEED)),
    )
    conn.execute(
        "INSERT INTO meta(key, value) VALUES (?, ?)",
        ("as_of_period", periods[-1]),
    )

    conn.executemany(
        "INSERT INTO accounts VALUES (?, ?, ?, ?)",
        ACCOUNTS,
    )
    conn.executemany(
        "INSERT INTO parties VALUES (?, ?, ?, ?)",
        [(p[0], p[1], "customer", p[2]) for p in CUSTOMERS]
        + [(p[0], p[1], "vendor", p[2]) for p in VENDORS],
    )

    balances: dict[tuple[str, str, str], float] = {}
    for mi, period in enumerate(periods):
        for ei, entity in enumerate(ENTITIES):
            for acct, *_ in ACCOUNTS:
                balances[(period, entity, acct)] = base_balance(acct, ei, mi)

    anomalies = plant_anomalies(balances, periods, entity="US-01")

    conn.executemany(
        "INSERT INTO trial_balance(period, entity, account_id, ending_balance) VALUES (?, ?, ?, ?)",
        [(p, e, a, bal) for (p, e, a), bal in balances.items()],
    )

    sub = build_subledger(periods, "US-01", anomalies)
    conn.executemany(
        "INSERT INTO subledger VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        sub,
    )
    conn.executemany(
        "INSERT INTO close_tasks VALUES (?, ?, ?, ?, ?, ?, ?)",
        build_close_tasks(periods[-1]),
    )
    conn.executemany(
        "INSERT INTO anomalies VALUES (?, ?, ?, ?, ?, ?)",
        [
            (
                a.id,
                a.account,
                a.period,
                a.kind,
                a.explanation,
                json.dumps(a.expected_citations),
            )
            for a in anomalies
        ],
    )
    conn.commit()

    eval_set = build_eval_set(anomalies, periods)
    eval_path = ROOT / "evals" / "variance_eval_set.json"
    eval_path.parent.mkdir(parents=True, exist_ok=True)
    eval_path.write_text(json.dumps(eval_set, indent=2), encoding="utf-8")

    # Static export for the GitHub Pages demo UI
    export = export_demo_bundle(conn, periods, anomalies, eval_set)
    export_path = EXPORT_DIR / "demo_bundle.json"
    export_path.write_text(json.dumps(export, indent=2), encoding="utf-8")

    # Also copy into frontend for Vite bundling
    fe_data = ROOT.parent / "frontend" / "data" / "closeAgentDemo.json"
    fe_data.parent.mkdir(parents=True, exist_ok=True)
    fe_data.write_text(json.dumps(export, indent=2), encoding="utf-8")

    conn.close()
    return {
        "db_path": str(db_path),
        "periods": periods[-2:],
        "anomaly_count": len(anomalies),
        "eval_cases": len(eval_set),
        "export_path": str(export_path),
    }


def export_demo_bundle(
    conn: sqlite3.Connection,
    periods: list[str],
    anomalies: list[PlantedAnomaly],
    eval_set: list[dict],
) -> dict:
    period = periods[-1]
    prior = periods[-2]
    entity = "US-01"

    def q(sql: str, params: tuple = ()) -> list[dict]:
        cur = conn.execute(sql, params)
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]

    tb = q(
        """
        SELECT t.period, t.entity, t.account_id, a.name, a.account_type, t.ending_balance
        FROM trial_balance t
        JOIN accounts a ON a.account_id = t.account_id
        WHERE t.entity = ? AND t.period IN (?, ?)
        ORDER BY t.account_id, t.period
        """,
        (entity, prior, period),
    )
    sub = q(
        "SELECT * FROM subledger WHERE entity = ? AND period = ? ORDER BY txn_date, txn_id",
        (entity, period),
    )
    tasks = q("SELECT * FROM close_tasks WHERE period = ? ORDER BY due_day", (period,))

    # Precompute variances for the interactive demo
    by_key: dict[tuple[str, str], float] = {
        (r["account_id"], r["period"]): r["ending_balance"] for r in tb
    }
    names = {r["account_id"]: r["name"] for r in tb}
    variances = []
    for acct, *_ in ACCOUNTS:
        a = by_key.get((acct, prior), 0.0)
        b = by_key.get((acct, period), 0.0)
        delta = b - a
        pct = (delta / a) if abs(a) > 1 else (1.0 if abs(delta) > 0 else 0.0)
        variances.append(
            {
                "account_id": acct,
                "account_name": names.get(acct, acct),
                "period_a": prior,
                "period_b": period,
                "balance_a": a,
                "balance_b": b,
                "variance_amt": round(delta, 2),
                "variance_pct": round(pct, 4),
                "over_threshold": abs(pct) > 0.10 and abs(delta) > 50_000,
            }
        )

    return {
        "disclaimer": "All figures are synthetic demo data — not real company financials.",
        "entity": entity,
        "period": period,
        "prior_period": prior,
        "threshold_pct": 0.10,
        "threshold_amt": 50_000,
        "trial_balance": tb,
        "subledger": sub,
        "close_tasks": tasks,
        "variances": variances,
        "anomalies": [asdict(a) for a in anomalies],
        "eval_set": eval_set,
        "eval_score": {
            "cases": len(eval_set),
            "accurate": len(eval_set),
            "accuracy": 0.0,
            "pass_rate": 0.0,
            "notes": (
                "Placeholder — run python evals/run_evals.py after generate_data.py "
                "to refresh accuracy on the heuristic agent."
            ),
        },
        "sample_tool_log": [
            {
                "tool_name": "get_account_variance",
                "arguments": {"account": "2100", "period_a": prior, "period_b": period},
                "result_summary": "variance_amt=-185000+; over_threshold=true",
            },
            {
                "tool_name": "get_subledger_detail",
                "arguments": {"account": "2100", "period": period},
                "result_summary": "2 accrual JEs for V-201 including DUP",
            },
            {
                "tool_name": "draft_flux_commentary",
                "arguments": {"account": "2100", "threshold": 0.10},
                "result_summary": "low-confidence duplicate accrual draft queued for review",
            },
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DB_PATH)
    args = parser.parse_args()
    result = generate(args.db)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
