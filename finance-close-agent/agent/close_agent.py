#!/usr/bin/env python3
"""Heuristic Close Agent — flags threshold breaches using config/policy.yaml."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import connect, get_meta  # noqa: E402
from policy import flag_variances, load_policy  # noqa: E402
from tools import draft_flux_commentary, list_open_close_tasks, reset_policy_cache  # noqa: E402


def run_close_pass(
    entity: str | None = None,
    policy_path: str | Path | None = None,
    draft: bool = False,
) -> dict:
    """Flag MoM breaches per policy.

    When ``entity`` is None, scans all entities and all consecutive periods.
    """
    reset_policy_cache()
    policy = load_policy(policy_path)
    with connect() as conn:
        as_of = get_meta(conn, "as_of_period")
        flagged = flag_variances(policy, conn)

    if entity:
        flagged = [f for f in flagged if f["entity"] == entity]

    flagged.sort(key=lambda r: (r["entity"], r["period_b"], r["account_id"]))

    drafts = []
    if draft:
        for row in flagged:
            drafts.append(
                draft_flux_commentary(
                    row["account_id"],
                    threshold=None,
                    entity=row["entity"],
                    period=row["period_b"],
                    prior_period=row["period_a"],
                    policy=policy,
                )
            )

    tasks = list_open_close_tasks(period=as_of, entity=entity)
    return {
        "disclaimer": "SYNTHETIC DATA — Northwind Digital demo only",
        "policy_path": str(policy.source_path),
        "threshold_pct": policy.variance.threshold_pct,
        "threshold_amt": policy.variance.threshold_amt,
        "entity_filter": entity,
        "as_of_period": as_of,
        "open_tasks": tasks.get("open_count"),
        "flagged_count": len(flagged),
        "flagged": [
            {
                "entity": f["entity"],
                "account_id": f["account_id"],
                "account_name": f["account_name"],
                "period_a": f["period_a"],
                "period_b": f["period_b"],
                "variance_pct": f["variance_pct"],
                "variance_amt": f["variance_amt"],
                "threshold_pct": f["threshold_pct"],
                "threshold_amt": f["threshold_amt"],
            }
            for f in flagged
        ],
        "drafts": drafts,
        "review_queued": sum(
            1 for d in drafts if d.get("status") == "queued_for_review"
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--entity",
        default=None,
        help="Optional entity filter (default: all entities)",
    )
    parser.add_argument(
        "--policy",
        default=None,
        help="Path to policy YAML (default: config/policy.yaml)",
    )
    parser.add_argument(
        "--draft",
        action="store_true",
        help="Also draft flux commentary for flagged accounts",
    )
    args = parser.parse_args()
    result = run_close_pass(entity=args.entity, policy_path=args.policy, draft=args.draft)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
