#!/usr/bin/env python3
"""Print planted anomaly IDs from finance.db (slice 2 verification)."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "finance.db"


def main() -> int:
    if not DB_PATH.exists():
        print(f"ERROR: missing {DB_PATH}. Run: python generate_data.py")
        return 1

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT anomaly_id, account_id, entity, period, amount,
               kind, expected_confidence
        FROM anomalies
        ORDER BY anomaly_id
        """
    ).fetchall()
    if not rows:
        print("ERROR: anomalies table is empty")
        conn.close()
        return 1

    print("=== Planted anomalies ===")
    for r in rows:
        print(
            f"{r['anomaly_id']}: account={r['account_id']} entity={r['entity']} "
            f"period={r['period']} amount={r['amount']:,.2f} "
            f"kind={r['kind']} confidence={r['expected_confidence']}"
        )
    print(f"count: {len(rows)}")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
