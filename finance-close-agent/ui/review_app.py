#!/usr/bin/env python3
"""Streamlit review UI — approve/edit flux drafts and inspect tool-call audit log.

Slice 5 polish: confidence-sorted queue, full item fields, required reviewer notes,
status history, and a tool-call log tab. Does not change MCP tools / agent / evals.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import streamlit as st

from agent.close_agent import run_close_pass
from tools import get_tool_call_log, list_review_queue, update_review_item
from ui.queue_helpers import (
    parse_citations,
    pass_index,
    policy_rule_for,
    served_item_label,
    sort_queue,
)


def _append_history(item_id: str, status: str, note: str) -> None:
    hist = st.session_state.setdefault("status_history", {})
    entries = hist.setdefault(item_id, [])
    entries.append(
        {
            "ts": datetime.now(timezone.utc).isoformat(),
            "status": status,
            "note": note,
        }
    )


def _seed_history(item: dict) -> list[dict]:
    hist = st.session_state.setdefault("status_history", {})
    item_id = item["item_id"]
    if item_id not in hist:
        hist[item_id] = [
            {
                "ts": item.get("created_at") or "",
                "status": "pending",
                "note": "(queued by close pass)",
            }
        ]
    return hist[item_id]


st.set_page_config(page_title="Close Agent Review Queue", layout="wide")

st.title("Close Agent Review Queue")
st.caption(
    "Synthetic demo data only — not real company financials. "
    "Queue sorted by confidence (low → med → high), then |variance| descending. "
    "Approve / edit / reject require a reviewer note."
)

col_a, col_b = st.columns([1, 1])
with col_a:
    if st.button("Run close pass (all entities)", type="primary"):
        with st.spinner("Flagging variances and drafting commentary…"):
            result = run_close_pass(draft=True)
        st.session_state["last_pass"] = result
        st.session_state["status_history"] = {}
        st.success(
            f"Flagged {result['flagged_count']} accounts · "
            f"{result['review_queued']} queued for review "
            f"(med/low) · pending rows created for all flagged items"
        )

with col_b:
    status = st.selectbox(
        "Queue filter",
        ["pending", "approved", "edited", "rejected", None],
        index=0,
        format_func=lambda s: "all" if s is None else s,
    )

if "last_pass" in st.session_state:
    with st.expander("Last close pass summary", expanded=False):
        st.json(st.session_state["last_pass"])

tab_queue, tab_log = st.tabs(["Review queue", "Tool-call log"])

index = pass_index(st.session_state.get("last_pass"))

with tab_queue:
    queue = list_review_queue(status=status)
    items = sort_queue(queue.get("items") or [])

    st.subheader(f"Review items ({len(items)})")
    st.caption("Order: low confidence first, then largest |dollar| variance.")
    if not items:
        st.info("Queue empty. Run a close pass to draft commentary.")

    for item in items:
        conf = str(item.get("confidence") or "")
        meta = index.get(
            (item.get("entity"), item.get("account_id"), item.get("period"))
        ) or {}
        citations = list(meta.get("citations") or []) or parse_citations(
            item.get("edited_commentary") or item.get("draft_commentary") or ""
        )
        rule = policy_rule_for(item, index)
        history = _seed_history(item)

        with st.container(border=True):
            st.markdown(
                f"**{item['account_id']}** · {item['entity']} · {item['period']}  \n"
                f"Variance **{item['variance_amt']:+,.0f}** "
                f"({item['variance_pct']:.1%}) · "
                f"confidence **{conf}** · status `{item['status']}` · "
                f"policy rule `{rule}`"
            )
            st.markdown("**Commentary**")
            edited = st.text_area(
                "Commentary",
                value=item.get("edited_commentary") or item["draft_commentary"],
                key=f"c-{item['item_id']}",
                height=140,
                label_visibility="collapsed",
            )
            st.markdown(
                "**Cited transaction IDs:** "
                + (", ".join(citations) if citations else "_(none)_")
            )
            note = st.text_input(
                "Reviewer note (required for approve / edit / reject)",
                key=f"n-{item['item_id']}",
                value=item.get("reviewer_note") or "",
            )
            b1, b2, b3 = st.columns(3)

            def _require_note(action: str, note_val: str = note) -> bool:
                if note_val and str(note_val).strip():
                    return True
                st.error(
                    f"Reviewer note is required before {action}. "
                    "Low-confidence approve is also blocked by the API without a note."
                )
                return False

            if b1.button("Approve", key=f"a-{item['item_id']}"):
                if _require_note("approve"):
                    result = update_review_item(
                        item["item_id"], "approved", edited, note
                    )
                    if result.get("error"):
                        st.error(result.get("message") or result["error"])
                    else:
                        _append_history(item["item_id"], "approved", note)
                        st.rerun()
            if b2.button("Save edit", key=f"e-{item['item_id']}"):
                if _require_note("edit"):
                    update_review_item(item["item_id"], "edited", edited, note)
                    _append_history(item["item_id"], "edited", note)
                    st.rerun()
            if b3.button("Reject", key=f"r-{item['item_id']}"):
                if _require_note("reject"):
                    update_review_item(item["item_id"], "rejected", edited, note)
                    _append_history(item["item_id"], "rejected", note)
                    st.rerun()

            with st.expander("Status history", expanded=False):
                for entry in history:
                    st.markdown(
                        f"- `{entry.get('ts', '')}` → **{entry.get('status')}** — "
                        f"{entry.get('note') or ''}"
                    )

with tab_log:
    st.subheader("Tool-call audit log")
    log = get_tool_call_log(limit=80)
    calls = log.get("calls") or []
    if not calls:
        st.info("No tool calls yet. Run a close pass.")
    else:
        rows = [
            {
                "timestamp": c.get("ts"),
                "tool": c.get("tool_name"),
                "inputs": c.get("arguments"),
                "served_item": served_item_label(c.get("arguments") or "{}", index),
                "result_summary": c.get("result_summary"),
            }
            for c in calls
        ]
        st.dataframe(rows, use_container_width=True)
