#!/usr/bin/env python3
"""Heuristic Close Agent — flags threshold breaches, drafts flux, queues review.

This is the offline stand-in for an LLM agent using the same MCP tools.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import connect, get_meta  # noqa: E402
from tools import (  # noqa: E402
    draft_flux_commentary,
    get_account_variance,
    list_open_close_tasks,
)


def run_close_pass(
    entity: str = "US-01",
    threshold_pct: float = 0.10,
    threshold_amt: float = 50_000.0,
) -> dict:
    with connect() as conn:
        period = get_meta(conn, "as_of_period")
        y, m = map(int, period.split("-"))
        m -= 1
        if m == 0:
            y -= 1
            m = 12
        prior = f"{y:04d}-{m:02d}"
        accounts = [
            r["account_id"]
            for r in conn.execute("SELECT account_id FROM accounts ORDER BY account_id")
        ]

    tasks = list_open_close_tasks(period=period, entity=entity)
    flagged = []
    drafts = []

    for account in accounts:
        variance = get_account_variance(account, prior, period, entity=entity)
        if variance.get("error"):
            continue
        if abs(variance["variance_pct"]) > threshold_pct and abs(
            variance["variance_amt"]
        ) > threshold_amt:
            flagged.append(variance)
            draft = draft_flux_commentary(
                account, threshold=threshold_pct, entity=entity
            )
            drafts.append(draft)

    return {
        "disclaimer": "SYNTHETIC DATA — not real company financials",
        "entity": entity,
        "period": period,
        "prior_period": prior,
        "open_tasks": tasks.get("open_count"),
        "flagged_count": len(flagged),
        "flagged": flagged,
        "drafts": drafts,
        "review_queued": sum(
            1 for d in drafts if d.get("status") == "queued_for_review"
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--entity", default="US-01")
    parser.add_argument("--threshold-pct", type=float, default=0.10)
    parser.add_argument("--threshold-amt", type=float, default=50_000.0)
    args = parser.parse_args()
    result = run_close_pass(args.entity, args.threshold_pct, args.threshold_amt)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
