#!/usr/bin/env python3
"""Generate clean synthetic finance data for Northwind Digital (SQLite).

Company: Northwind Digital
Entities: ND-US, ND-EU
No planted anomalies in this generator (slice 2 will add them).
All figures are synthetic. source_system labels are generic only.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sqlite3
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "finance.db"
EXPORT_DIR = ROOT / "exports"
SEED = 42
COMPANY = "Northwind Digital"
ENTITIES = ["ND-US", "ND-EU"]

# ~40-account chart of accounts (id, name, type, statement)
ACCOUNTS: list[tuple[str, str, str, str]] = [
    # Assets
    ("1000", "Cash", "Asset", "BS"),
    ("1100", "Accounts Receivable", "Asset", "BS"),
    ("1200", "Prepaid Expenses", "Asset", "BS"),
    ("1300", "Other Current Assets", "Asset", "BS"),
    ("1400", "Property Plant & Equipment", "Asset", "BS"),
    ("1500", "Accumulated Depreciation", "Asset", "BS"),  # contra (credit)
    ("1600", "Intangible Assets", "Asset", "BS"),
    # Liabilities
    ("2000", "Accounts Payable", "Liability", "BS"),
    ("2100", "Accrued Expenses", "Liability", "BS"),
    ("2200", "Accrued Payroll", "Liability", "BS"),
    ("2300", "Deferred Revenue", "Liability", "BS"),
    ("2400", "Short-term Debt", "Liability", "BS"),
    ("2500", "Long-term Debt", "Liability", "BS"),
    # Equity
    ("3000", "Common Stock", "Equity", "BS"),
    ("3100", "Additional Paid-in Capital", "Equity", "BS"),
    ("3200", "Retained Earnings", "Equity", "BS"),
    # Revenue
    ("4000", "Subscription Revenue", "Revenue", "PL"),
    ("4100", "Usage Revenue", "Revenue", "PL"),
    ("4200", "Services Revenue", "Revenue", "PL"),
    ("4300", "Other Revenue", "Revenue", "PL"),
    # COGS
    ("5000", "Cost of Subscription", "Expense", "PL"),
    ("5100", "Cost of Usage", "Expense", "PL"),
    ("5200", "Cost of Services Delivery", "Expense", "PL"),
    # Opex (12+)
    ("6000", "Salaries & Wages", "Expense", "PL"),
    ("6010", "Employee Benefits", "Expense", "PL"),
    ("6020", "Contractors", "Expense", "PL"),
    ("6100", "Software Subscriptions", "Expense", "PL"),
    ("6110", "Cloud Hosting", "Expense", "PL"),
    ("6200", "Marketing & Advertising", "Expense", "PL"),
    ("6300", "Travel", "Expense", "PL"),
    ("6310", "Meals & Entertainment", "Expense", "PL"),
    ("6400", "Rent & Facilities", "Expense", "PL"),
    ("6500", "Professional Fees", "Expense", "PL"),
    ("6600", "Recruiting", "Expense", "PL"),
    ("6700", "Depreciation Expense", "Expense", "PL"),
    ("6800", "Training & Development", "Expense", "PL"),
    ("6900", "Office Supplies", "Expense", "PL"),
    ("6950", "Insurance", "Expense", "PL"),
    ("7000", "Bad Debt Expense", "Expense", "PL"),
    ("7100", "Bank Fees", "Expense", "PL"),
]

# Base monthly magnitude by account (signed: credit-normal negative for liability/equity/revenue)
BASE_MONTHLY: dict[str, float] = {
    "1000": 4_200_000,
    "1100": 2_100_000,
    "1200": 380_000,
    "1300": 210_000,
    "1400": 3_400_000,
    "1500": -980_000,
    "1600": 720_000,
    "2000": -890_000,
    "2100": -420_000,
    "2200": -310_000,
    "2300": -1_150_000,
    "2400": -250_000,
    "2500": -1_800_000,
    "3000": -100_000,
    "3100": -4_500_000,
    "3200": -2_200_000,
    # P&L monthly activity
    "4000": -1_850_000,
    "4100": -620_000,
    "4200": -410_000,
    "4300": -55_000,
    "5000": 420_000,
    "5100": 180_000,
    "5200": 145_000,
    "6000": 980_000,
    "6010": 210_000,
    "6020": 160_000,
    "6100": 95_000,
    "6110": 175_000,
    "6200": 240_000,
    "6300": 48_000,
    "6310": 22_000,
    "6400": 130_000,
    "6500": 85_000,
    "6600": 40_000,
    "6700": 75_000,
    "6800": 18_000,
    "6900": 12_000,
    "6950": 35_000,
    "7000": 15_000,
    "7100": 8_000,
}

ENTITY_SCALE = {"ND-US": 1.0, "ND-EU": 0.58}

CUSTOMERS = [
    ("C-100", "Cedar Analytics", "US"),
    ("C-101", "Helios Retail Group", "US"),
    ("C-102", "Atlas Manufacturing", "DE"),
    ("C-103", "Blue Harbor Logistics", "UK"),
    ("C-104", "Cascade Health Systems", "US"),
    ("C-105", "Meridian Media Co", "FR"),
    ("C-106", "Pioneer Freight Lines", "NL"),
]

VENDORS = [
    ("V-200", "Nimbus Hosting Co", "US"),
    ("V-201", "Summit Legal Partners", "US"),
    ("V-202", "Harbor Facilities LLC", "US"),
    ("V-203", "Orbit Travel Desk", "IE"),
    ("V-204", "Prime Temp Staffing", "US"),
    ("V-205", "Brightline Marketing", "US"),
    ("V-206", "Cobalt Recruiting", "UK"),
    ("V-207", "Parcel Softwares Ltd", "DE"),
]

# Accounts with detailed subledgers that must reconcile to TB
AR_ACCOUNT = "1100"
AP_ACCOUNT = "2000"
ACCRUAL_ACCOUNTS = {"2100", "2200"}
OPEX_DETAIL_ACCOUNTS = {
    "6000",
    "6010",
    "6020",
    "6100",
    "6110",
    "6200",
    "6300",
    "6310",
    "6400",
    "6500",
    "6600",
    "6700",
    "6800",
    "6900",
    "6950",
    "7000",
    "7100",
    "5000",
    "5100",
    "5200",
}


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
            source_system TEXT NOT NULL,
            entry_type TEXT NOT NULL
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


def seasonality_factor(account_id: str, month: int) -> float:
    """Mild seasonality so MoM stays mostly under threshold."""
    # month: 1-12
    angle = 2 * math.pi * (month - 1) / 12
    if account_id.startswith("4"):  # revenue: mild Q4 lift
        return 1.0 + 0.04 * math.sin(angle - 0.5) + (0.03 if month in (11, 12) else 0.0)
    if account_id in {"6200", "6300", "6310", "6600"}:  # marketing / travel / recruiting
        return 1.0 + 0.045 * math.sin(angle + 0.8)
    if account_id.startswith("5") or account_id.startswith("6") or account_id.startswith("7"):
        return 1.0 + 0.025 * math.sin(angle)
    if account_id == "1100":
        return 1.0 + 0.02 * math.sin(angle - 0.2)
    return 1.0 + 0.015 * math.sin(angle)


def balance_for(
    account_id: str,
    entity: str,
    month_idx: int,
    month_num: int,
    rng: random.Random,
) -> float:
    """Deterministic ending balance / monthly activity with growth + mild seasonality."""
    base = BASE_MONTHLY[account_id] * ENTITY_SCALE[entity]
    growth = 1.0 + month_idx * 0.0075  # ~0.75%/month
    seasonal = seasonality_factor(account_id, month_num)
    # Tiny deterministic noise (±1.2%) — keeps MoM under dual threshold
    noise = 1.0 + rng.uniform(-0.012, 0.012)
    return round(base * growth * seasonal * noise, 2)


def split_amount(total: float, n: int, rng: random.Random) -> list[float]:
    """Split total into n parts that sum exactly to total."""
    if n <= 0:
        return []
    if n == 1:
        return [round(total, 2)]
    weights = [rng.uniform(0.7, 1.3) for _ in range(n)]
    s = sum(weights)
    parts = [total * (w / s) for w in weights]
    parts = [round(p, 2) for p in parts]
    drift = round(total - sum(parts), 2)
    parts[-1] = round(parts[-1] + drift, 2)
    return parts


def build_ar_rows(
    period: str,
    entity: str,
    target: float,
    day0: date,
    rng: random.Random,
) -> list[tuple]:
    """Open AR as of period end: invoices + payments netting to TB AR balance."""
    rows: list[tuple] = []
    n_inv = 5 if entity == "ND-US" else 4
    # Payments as ~25% of gross invoices so invoices are larger than target
    payment_ratio = 0.25
    gross = target / (1.0 - payment_ratio) if abs(1.0 - payment_ratio) > 1e-9 else target
    inv_amts = split_amount(gross, n_inv, rng)
    pay_total = round(gross - target, 2)
    n_pay = max(1, n_inv // 2)
    pay_amts = split_amount(pay_total, n_pay, rng)

    for i, amt in enumerate(inv_amts):
        cust = CUSTOMERS[(hash((period, entity, i)) & 0xFFFF) % len(CUSTOMERS)]
        txn_id = f"AR-INV-{entity}-{period}-{i+1:03d}"
        rows.append(
            (
                txn_id,
                period,
                entity,
                AR_ACCOUNT,
                (day0 + timedelta(days=2 + i * 3)).isoformat(),
                cust[0],
                f"Invoice {cust[1]} — subscription / usage",
                round(amt, 2),
                "Billing",
                "ar_invoice",
            )
        )
    for i, amt in enumerate(pay_amts):
        cust = CUSTOMERS[(hash((period, entity, "pay", i)) & 0xFFFF) % len(CUSTOMERS)]
        txn_id = f"AR-PAY-{entity}-{period}-{i+1:03d}"
        rows.append(
            (
                txn_id,
                period,
                entity,
                AR_ACCOUNT,
                (day0 + timedelta(days=10 + i * 4)).isoformat(),
                cust[0],
                f"Payment from {cust[1]}",
                round(-amt, 2),
                "Billing",
                "ar_payment",
            )
        )
    return rows


def build_ap_rows(
    period: str,
    entity: str,
    target: float,
    day0: date,
    rng: random.Random,
) -> list[tuple]:
    """AP open items (credit-normal negative target) reconciling to TB."""
    rows: list[tuple] = []
    n = 4 if entity == "ND-US" else 3
    # target is negative; split into negative bill amounts
    amts = split_amount(target, n, rng)
    for i, amt in enumerate(amts):
        vend = VENDORS[(hash((period, entity, i)) & 0xFFFF) % len(VENDORS)]
        rows.append(
            (
                f"AP-BILL-{entity}-{period}-{i+1:03d}",
                period,
                entity,
                AP_ACCOUNT,
                (day0 + timedelta(days=3 + i * 5)).isoformat(),
                vend[0],
                f"Vendor bill — {vend[1]}",
                round(amt, 2),
                "ERP",
                "ap_bill",
            )
        )
    return rows


def build_accrual_rows(
    account_id: str,
    period: str,
    entity: str,
    target: float,
    day0: date,
    rng: random.Random,
) -> list[tuple]:
    rows: list[tuple] = []
    n = 3
    amts = split_amount(target, n, rng)
    label = "payroll" if account_id == "2200" else "operating"
    source = "HRIS" if account_id == "2200" else "ERP"
    for i, amt in enumerate(amts):
        vend = VENDORS[(hash((account_id, period, entity, i)) & 0xFFFF) % len(VENDORS)]
        rows.append(
            (
                f"ACCR-{account_id}-{entity}-{period}-{i+1:03d}",
                period,
                entity,
                account_id,
                (day0 + timedelta(days=20 + i)).isoformat(),
                vend[0] if account_id != "2200" else None,
                f"Month-end {label} accrual",
                round(amt, 2),
                source,
                "accrual",
            )
        )
    return rows


def build_expense_detail_rows(
    account_id: str,
    period: str,
    entity: str,
    target: float,
    day0: date,
    rng: random.Random,
) -> list[tuple]:
    """P&L expense detail summing to monthly TB activity."""
    rows: list[tuple] = []
    n = 3 if abs(target) > 50_000 else 2
    amts = split_amount(target, n, rng)
    name = next(a[1] for a in ACCOUNTS if a[0] == account_id)
    for i, amt in enumerate(amts):
        vend = VENDORS[(hash((account_id, period, entity, i)) & 0xFFFF) % len(VENDORS)]
        if account_id in {"6000", "6010", "6020", "6600"}:
            source = "HRIS"
            party = None if account_id in {"6000", "6010"} else vend[0]
        elif account_id in {"6300", "6310"}:
            source = "Expense Tool"
            party = vend[0]
        else:
            source = "ERP"
            party = vend[0]
        rows.append(
            (
                f"EXP-{account_id}-{entity}-{period}-{i+1:03d}",
                period,
                entity,
                account_id,
                (day0 + timedelta(days=4 + i * 6)).isoformat(),
                party,
                f"{name} — period activity",
                round(amt, 2),
                source,
                "expense_detail",
            )
        )
    return rows


def build_close_tasks(period: str) -> list[tuple]:
    return [
        (f"T-{period}-01", period, "ND-US", "Post payroll accrual", "Close lead", "done", 1),
        (f"T-{period}-02", period, "ND-US", "Flux accounts >10% / >$50K", "FP&A", "in_progress", 2),
        (f"T-{period}-03", period, "ND-US", "AR subledger tie-out", "AR lead", "in_progress", 2),
        (f"T-{period}-04", period, "ND-US", "Review manual JEs >$100K", "Controller", "open", 3),
        (f"T-{period}-05", period, "ND-US", "Deferred revenue rollforward", "Revenue", "open", 3),
        (f"T-{period}-06", period, "ND-EU", "Intercompany confirmations", "EU close", "open", 4),
    ]


def generate(db_path: Path = DB_PATH) -> dict:
    random.seed(SEED)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()

    periods_dates = month_starts(24)
    periods = [period_label(d) for d in periods_dates]
    conn = sqlite3.connect(db_path)
    ensure_schema(conn)

    conn.execute(
        "INSERT INTO meta(key, value) VALUES (?, ?)",
        ("disclaimer", "SYNTHETIC DATA — Northwind Digital demo only"),
    )
    conn.execute("INSERT INTO meta(key, value) VALUES (?, ?)", ("company", COMPANY))
    conn.execute("INSERT INTO meta(key, value) VALUES (?, ?)", ("seed", str(SEED)))
    conn.execute(
        "INSERT INTO meta(key, value) VALUES (?, ?)",
        ("as_of_period", periods[-1]),
    )
    conn.execute(
        "INSERT INTO meta(key, value) VALUES (?, ?)",
        ("anomalies", "none — clean baseline (slice 1)"),
    )

    conn.executemany("INSERT INTO accounts VALUES (?, ?, ?, ?)", ACCOUNTS)
    conn.executemany(
        "INSERT INTO parties VALUES (?, ?, ?, ?)",
        [(p[0], p[1], "customer", p[2]) for p in CUSTOMERS]
        + [(p[0], p[1], "vendor", p[2]) for p in VENDORS],
    )

    balances: dict[tuple[str, str, str], float] = {}
    for mi, (period, d) in enumerate(zip(periods, periods_dates)):
        for entity in ENTITIES:
            rng = random.Random(f"{SEED}:{entity}:{period}")
            for acct, *_ in ACCOUNTS:
                balances[(period, entity, acct)] = balance_for(
                    acct, entity, mi, d.month, rng
                )

    conn.executemany(
        "INSERT INTO trial_balance(period, entity, account_id, ending_balance) VALUES (?, ?, ?, ?)",
        [(p, e, a, bal) for (p, e, a), bal in balances.items()],
    )

    sub_rows: list[tuple] = []
    for period, d in zip(periods, periods_dates):
        for entity in ENTITIES:
            rng = random.Random(f"{SEED}:sub:{entity}:{period}")
            # AR
            sub_rows.extend(
                build_ar_rows(period, entity, balances[(period, entity, AR_ACCOUNT)], d, rng)
            )
            # AP
            sub_rows.extend(
                build_ap_rows(period, entity, balances[(period, entity, AP_ACCOUNT)], d, rng)
            )
            # Accruals
            for acct in sorted(ACCRUAL_ACCOUNTS):
                sub_rows.extend(
                    build_accrual_rows(
                        acct, period, entity, balances[(period, entity, acct)], d, rng
                    )
                )
            # Expense / COGS detail
            for acct in sorted(OPEX_DETAIL_ACCOUNTS):
                sub_rows.extend(
                    build_expense_detail_rows(
                        acct, period, entity, balances[(period, entity, acct)], d, rng
                    )
                )

    conn.executemany(
        "INSERT INTO subledger VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        sub_rows,
    )
    conn.executemany(
        "INSERT INTO close_tasks VALUES (?, ?, ?, ?, ?, ?, ?)",
        build_close_tasks(periods[-1]),
    )
    # anomalies table intentionally empty (slice 2)
    conn.commit()

    export = export_demo_bundle(conn, periods)
    export_path = EXPORT_DIR / "demo_bundle.json"
    export_path.write_text(json.dumps(export, indent=2), encoding="utf-8")

    summary = {
        "company": COMPANY,
        "db_path": str(db_path),
        "accounts": len(ACCOUNTS),
        "entities": ENTITIES,
        "periods": len(periods),
        "as_of_period": periods[-1],
        "subledger_rows": len(sub_rows),
        "anomalies": 0,
        "export_path": str(export_path),
    }
    conn.close()
    return summary


def export_demo_bundle(conn: sqlite3.Connection, periods: list[str]) -> dict:
    period = periods[-1]
    prior = periods[-2]
    entity = "ND-US"

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

    by_key = {(r["account_id"], r["period"]): r["ending_balance"] for r in tb}
    names = {r["account_id"]: r["name"] for r in tb}
    variances = []
    for acct, name, *_ in ACCOUNTS:
        a = by_key.get((acct, prior), 0.0)
        b = by_key.get((acct, period), 0.0)
        delta = b - a
        pct = (delta / a) if abs(a) > 1 else (1.0 if abs(delta) > 0 else 0.0)
        variances.append(
            {
                "account_id": acct,
                "account_name": names.get(acct, name),
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
        "disclaimer": (
            "All figures are synthetic demo data for fictional company "
            "Northwind Digital — not real company financials."
        ),
        "company": COMPANY,
        "entity": entity,
        "period": period,
        "prior_period": prior,
        "threshold_pct": 0.10,
        "threshold_amt": 50_000,
        "trial_balance": tb,
        "subledger": sub,
        "close_tasks": tasks,
        "variances": variances,
        "anomalies": [],
        "note": "Clean baseline — planted anomalies deferred to slice 2.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DB_PATH)
    args = parser.parse_args()
    result = generate(args.db)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
