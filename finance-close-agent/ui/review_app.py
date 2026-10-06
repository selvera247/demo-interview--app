#!/usr/bin/env python3
"""Streamlit review UI — approve/edit flux drafts and inspect tool-call audit log."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import streamlit as st

from agent.close_agent import run_close_pass
from tools import get_tool_call_log, list_review_queue, update_review_item


st.set_page_config(page_title="Close Agent Review Queue", layout="wide")

st.title("Close Agent Review Queue")
st.caption(
    "Synthetic demo data only — not real company financials. "
    "Approve, edit, or send back drafts before commentary hits the flux package. "
    "Confidence labels: high / med / low (low requires human review)."
)

col_a, col_b = st.columns([1, 1])
with col_a:
    if st.button("Run close pass (all entities)", type="primary"):
        with st.spinner("Flagging variances and drafting commentary…"):
            result = run_close_pass(draft=True)
        st.session_state["last_pass"] = result
        st.success(
            f"Flagged {result['flagged_count']} accounts · "
            f"{result['review_queued']} queued for review"
        )

with col_b:
    status = st.selectbox(
        "Queue filter", ["pending", "approved", "edited", "rejected", None], index=0
    )

if "last_pass" in st.session_state:
    with st.expander("Last close pass summary", expanded=False):
        st.json(st.session_state["last_pass"])

queue = list_review_queue(status=status)
items = queue.get("items") or []

st.subheader(f"Review items ({len(items)})")
if not items:
    st.info("Queue empty. Run a close pass to draft commentary.")

for item in items:
    conf = item.get("confidence")
    conf_label = conf if isinstance(conf, str) else str(conf)
    with st.container(border=True):
        st.markdown(
            f"**{item['account_id']}** · {item['period']} · {item['entity']}  \n"
            f"Variance {item['variance_pct']:.1%} ({item['variance_amt']:+,.0f}) · "
            f"confidence **{conf_label}** · status `{item['status']}`"
        )
        edited = st.text_area(
            "Commentary",
            value=item.get("edited_commentary") or item["draft_commentary"],
            key=f"c-{item['item_id']}",
            height=120,
        )
        note = st.text_input(
            "Reviewer note (required to approve low-confidence items)",
            key=f"n-{item['item_id']}",
            value=item.get("reviewer_note") or "",
        )
        b1, b2, b3 = st.columns(3)
        if b1.button("Approve", key=f"a-{item['item_id']}"):
            result = update_review_item(item["item_id"], "approved", edited, note)
            if result.get("error"):
                st.error(result.get("message") or result["error"])
            else:
                st.rerun()
        if b2.button("Save edit", key=f"e-{item['item_id']}"):
            update_review_item(item["item_id"], "edited", edited, note)
            st.rerun()
        if b3.button("Reject", key=f"r-{item['item_id']}"):
            update_review_item(item["item_id"], "rejected", edited, note)
            st.rerun()

st.subheader("Tool call audit log")
log = get_tool_call_log(limit=40)
st.dataframe(log.get("calls") or [], use_container_width=True)
