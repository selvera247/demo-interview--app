#!/usr/bin/env python3
"""Verify Northwind Digital finance.db (reconciliation + expected breach set)."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from policy import flag_variances, load_policy  # noqa: E402

DB_PATH = ROOT / "data" / "finance.db"

DETAIL_ACCOUNTS = {
    "1100",
    "2000",
    "2100",
    "2200",
    "4000",
    "4100",
    "4200",
    "4300",
    "5000",
    "5100",
    "5200",
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
}

EXPECTED_BREACHES = {
    ("ND-US", "6110", "2026-06"),
    ("ND-EU", "6020", "2026-07"),
    ("ND-EU", "6500", "2026-07"),
    ("ND-US", "4000", "2026-06"),
    ("ND-US", "4000", "2026-07"),
    ("ND-US", "6310", "2026-09"),
    ("ND-US", "6200", "2026-09"),
    ("ND-US", "6600", "2026-03"),
    ("ND-EU", "6100", "2026-08"),  # C1
}


def main() -> int:
    if not DB_PATH.exists():
        print(f"ERROR: missing {DB_PATH}. Run: python generate_data.py")
        return 1

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    exit_code = 0
    policy = load_policy()

    print("=== 1) Counts ===")
    accounts = conn.execute("SELECT COUNT(*) AS n FROM accounts").fetchone()["n"]
    entities = [
        r["entity"]
        for r in conn.execute(
            "SELECT DISTINCT entity FROM trial_balance ORDER BY entity"
        )
    ]
    periods = conn.execute(
        "SELECT COUNT(DISTINCT period) AS n FROM trial_balance"
    ).fetchone()["n"]
    ar_invoices = conn.execute(
        "SELECT COUNT(*) AS n FROM subledger WHERE entry_type = 'ar_invoice'"
    ).fetchone()["n"]
    ap_accrual = conn.execute(
        """
        SELECT COUNT(*) AS n FROM subledger
        WHERE entry_type IN ('ap_bill', 'accrual', 'expense_detail', 'reclass',
                             'manual_je', 'revenue_detail', 'revenue_timing')
        """
    ).fetchone()["n"]
    company = conn.execute(
        "SELECT value FROM meta WHERE key = 'company'"
    ).fetchone()
    print(f"company:           {company['value'] if company else '(missing)'}")
    print(f"accounts:          {accounts}")
    print(f"entities:          {entities} ({len(entities)})")
    print(f"periods:           {periods}")
    print(f"AR invoices:       {ar_invoices}")
    print(f"AP/accrual/opex:   {ap_accrual}")
    print(
        f"policy thresholds: pct>{policy.variance.threshold_pct} AND "
        f"amt>{policy.variance.threshold_amt}"
    )

    print("\n=== 2) Subledger ↔ TB reconciliation ===")
    diffs = []
    rows = conn.execute(
        """
        SELECT t.period, t.entity, t.account_id, t.ending_balance AS tb,
               COALESCE(SUM(s.amount), 0) AS sub_sum
        FROM trial_balance t
        LEFT JOIN subledger s
          ON s.period = t.period
         AND s.entity = t.entity
         AND s.account_id = t.account_id
        WHERE t.account_id IN ({placeholders})
        GROUP BY t.period, t.entity, t.account_id, t.ending_balance
        """.format(
            placeholders=",".join("?" * len(DETAIL_ACCOUNTS))
        ),
        tuple(sorted(DETAIL_ACCOUNTS)),
    ).fetchall()
    for r in rows:
        delta = round(r["tb"] - r["sub_sum"], 2)
        if abs(delta) > 0.01:
            diffs.append(dict(r) | {"diff": delta})
    if not diffs:
        print(f"OK — {len(rows)} account-period-entity rows reconcile (diff ≤ $0.01)")
    else:
        exit_code = 1
        print(f"FAIL — {len(diffs)} differences:")
        for d in diffs[:20]:
            print(
                f"  {d['period']} {d['entity']} {d['account_id']}: "
                f"TB={d['tb']} SUB={d['sub_sum']} DIFF={d['diff']}"
            )

    print("\n=== 4) Threshold breaches (from policy.yaml) ===")
    breaches = flag_variances(policy, conn)
    print(f"breach_count: {len(breaches)}")
    for b in breaches:
        print(
            f"  {b['entity']} {b['account_id']} {b['period_a']}→{b['period_b']} "
            f"pct={b['variance_pct']:.1%} amt={b['variance_amt']:,.2f}"
        )

    actual_keys = {(b["entity"], b["account_id"], b["period_b"]) for b in breaches}
    missing = EXPECTED_BREACHES - actual_keys
    extra = actual_keys - EXPECTED_BREACHES
    print("\n=== Breach set check ===")
    if not missing and not extra:
        print(f"OK — exactly {len(EXPECTED_BREACHES)} expected breaches")
    else:
        exit_code = 1
        if missing:
            print(f"FAIL — missing: {sorted(missing)}")
        if extra:
            print(f"FAIL — unexpected: {sorted(extra)}")

    conn.close()
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
