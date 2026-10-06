#!/usr/bin/env python3
"""Text verification for slice 5 review-queue UX (no Streamlit screenshot).

Runs a close pass, prints the pending queue in UI sort order, and proves that
approving a low-confidence item without a reviewer note is blocked.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from agent.close_agent import run_close_pass  # noqa: E402
from tools import (  # noqa: E402
    get_tool_call_log,
    list_review_queue,
    reset_policy_cache,
    update_review_item,
)
from ui.queue_helpers import (  # noqa: E402
    CONF_ORDER,
    parse_citations,
    pass_index,
    policy_rule_for,
    served_item_label,
    sort_queue,
)

DB_PATH = ROOT / "data" / "finance.db"


def main() -> int:
    if not DB_PATH.exists():
        print("ERROR: missing data/finance.db — run python3 generate_data.py")
        return 1

    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM review_queue")
    conn.execute("DELETE FROM tool_call_log")
    conn.commit()
    conn.close()

    reset_policy_cache()
    result = run_close_pass(draft=True)
    print("=== Close pass ===")
    print(f"flagged_count: {result['flagged_count']}")
    print(f"review_queued (med/low): {result['review_queued']}")

    index = pass_index(result)
    pending = sort_queue(list_review_queue("pending")["items"])
    print(f"\n=== Pending queue ({len(pending)} items) — UI sort order ===")
    print("sort: confidence low→med→high, then |variance_amt| desc\n")

    prev_key = None
    order_ok = True
    for i, item in enumerate(pending, 1):
        meta = index.get(
            (item["entity"], item["account_id"], item["period"])
        ) or {}
        citations = list(meta.get("citations") or []) or parse_citations(
            item.get("draft_commentary") or ""
        )
        rule = policy_rule_for(item, index)
        conf = str(item.get("confidence") or "")
        print(
            f"{i:2}. conf={conf:4} | {item['account_id']} {item['entity']} "
            f"{item['period']} | var={item['variance_amt']:+,.0f} "
            f"({item['variance_pct']:.1%}) | rule={rule}"
        )
        print(f"    commentary: {(item.get('draft_commentary') or '')[:180]}…")
        print(f"    citations: {', '.join(citations) if citations else '(none)'}")
        print(f"    status: {item['status']}")

        key = (CONF_ORDER.get(conf, 9), -abs(float(item["variance_amt"])))
        if prev_key is not None and key < prev_key:
            order_ok = False
        prev_key = key

    print(f"\nordering_ok: {order_ok}")

    low = next((x for x in pending if x.get("confidence") == "low"), None)
    print("\n=== Approve low without note ===")
    if not low:
        print("FAIL — no low-confidence pending item")
        return 1
    blocked = update_review_item(low["item_id"], "approved", reviewer_note="")
    print(f"item: {low['item_id']} ({low['account_id']} {low['entity']})")
    print(f"result: {blocked}")
    note_blocked = blocked.get("error") == "human_action_required"
    print(f"blocked_without_note: {note_blocked}")

    print("\n=== UI note gate ===")
    print("Streamlit blocks approve/edit/reject when reviewer note is empty.")

    print("\n=== Tool-call log (sample) ===")
    calls = get_tool_call_log(limit=12).get("calls") or []
    for c in calls[:8]:
        print(
            f"  {c.get('ts')} | {c.get('tool_name')} | "
            f"served={served_item_label(c.get('arguments') or '{}', index)}"
        )

    confs = {i["confidence"] for i in pending}
    print("\n=== Confidence presence ===")
    print(f"levels_in_queue: {sorted(confs)}")
    print("high = explainable breaches with citations")
    print("med  = C1 Software partial ($60k license + $30k residual)")
    print("low  = A4 unsupported T&E JE (blank desc / no vendor)")

    ok = (
        order_ok
        and note_blocked
        and len(pending) == result["flagged_count"]
        and confs >= {"high", "med", "low"}
    )
    print(f"\nVERIFY {'OK' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
