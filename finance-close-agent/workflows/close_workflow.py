"""LangGraph close workflow: extract → flag → draft → approval_gate → summary.

All finance logic comes from ``agent.close_agent.run_close_pass`` / policy tools.
This module only stages the pass for API/audit narrative — no second variance engine.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TypedDict

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from agent.close_agent import run_close_pass  # noqa: E402
from audit.logger import AUDIT_LOG  # noqa: E402
from db import connect, get_meta  # noqa: E402
from policy import load_policy  # noqa: E402
from tools import reset_policy_cache  # noqa: E402

try:
    from langgraph.graph import END, StateGraph
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "langgraph is required for the close workflow. "
        "Install with: pip install -r requirements.txt"
    ) from exc


class CloseState(TypedDict, total=False):
    """Shared state for the close LangGraph."""

    entity: str | None
    policy_path: str | None
    user: str
    approval_status: bool
    context: dict[str, Any]
    close_pass: dict[str, Any]
    approval: dict[str, Any]
    summary: dict[str, Any]
    citations: list[dict[str, Any]]
    control_checks: list[dict[str, Any]]


def _extract(state: CloseState) -> dict[str, Any]:
    reset_policy_cache()
    policy = load_policy(state.get("policy_path"))
    with connect() as conn:
        as_of = get_meta(conn, "as_of_period")
        company = get_meta(conn, "company") or "Northwind Digital"
    context = {
        "company": company,
        "as_of_period": as_of,
        "entity_filter": state.get("entity"),
        "policy_path": str(policy.source_path),
        "threshold_pct": policy.variance.threshold_pct,
        "threshold_amt": policy.variance.threshold_amt,
        "scenario": "Month-end close variance review (synthetic Northwind Digital)",
    }
    AUDIT_LOG.log_event(
        source="close-workflow",
        user=state.get("user", "analyst_001"),
        action="extract",
        result="ok",
        control_mark="CTL-001",
        detail={"as_of_period": as_of, "entity": state.get("entity")},
    )
    return {"context": context}


def _flag_and_draft(state: CloseState) -> dict[str, Any]:
    """Run the existing close pass (flag + draft + review queue writes)."""
    result = run_close_pass(
        entity=state.get("entity"),
        policy_path=state.get("policy_path"),
        draft=True,
    )
    citations: list[dict[str, Any]] = []
    for draft in result.get("drafts") or []:
        for txn_id in draft.get("citations") or []:
            citations.append(
                {
                    "txn_id": txn_id,
                    "account": draft.get("account"),
                    "entity": draft.get("entity"),
                    "period": draft.get("period"),
                    "source_system": "ERP",
                }
            )
    AUDIT_LOG.log_event(
        source="close-workflow",
        user=state.get("user", "analyst_001"),
        action="flag_and_draft",
        result=f"flagged={result.get('flagged_count', 0)}",
        control_mark="CTL-002",
        detail={
            "flagged_count": result.get("flagged_count"),
            "review_queued": result.get("review_queued"),
        },
    )
    return {"close_pass": result, "citations": citations}


def _approval_gate(state: CloseState) -> dict[str, Any]:
    close_pass = state.get("close_pass") or {}
    review_queued = int(close_pass.get("review_queued") or 0)
    approved = bool(state.get("approval_status", True)) and review_queued == 0
    approval = {
        "approved": approved,
        "approver": state.get("user", "clerk-demo-user"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checkpoint": "CTL-003: Human approval required for med/low confidence",
        "review_queued": review_queued,
        "note": (
            "All high-confidence drafts draft-ready; no human gate pending."
            if approved
            else f"{review_queued} item(s) require human review before package finalization."
        ),
    }
    control_checks = [
        {
            "id": "CTL-001",
            "status": "pass",
            "description": "Source context loaded from synthetic SQLite ERP.",
        },
        {
            "id": "CTL-002",
            "status": "pass",
            "description": "Variances flagged via config/policy.yaml thresholds.",
        },
        {
            "id": "CTL-003",
            "status": "pass" if approved else "pending_review",
            "description": "Human approval checkpoint for med/low confidence drafts.",
        },
    ]
    AUDIT_LOG.log_event(
        source="close-workflow",
        user=state.get("user", "analyst_001"),
        action="approval_gate",
        result="approved" if approved else "pending_review",
        control_mark="CTL-003",
        detail={"review_queued": review_queued},
    )
    return {"approval": approval, "control_checks": control_checks}


def _summary(state: CloseState) -> dict[str, Any]:
    close_pass = state.get("close_pass") or {}
    approval = state.get("approval") or {}
    context = state.get("context") or {}
    review_queued = int(close_pass.get("review_queued") or 0)
    flagged = int(close_pass.get("flagged_count") or 0)
    status = "approved" if approval.get("approved") else "requires_review"
    summary = {
        "disclaimer": close_pass.get(
            "disclaimer", "SYNTHETIC DATA — Northwind Digital demo only"
        ),
        "company": context.get("company"),
        "as_of_period": context.get("as_of_period"),
        "status": status,
        "flagged_count": flagged,
        "review_queued": review_queued,
        "summary": (
            f"Close pass flagged {flagged} account(s); {review_queued} routed to "
            f"human review. Package status: {status}."
        ),
        "control_checks": state.get("control_checks") or [],
        "citations": state.get("citations") or [],
        "approval": approval,
        "close_pass": close_pass,
    }
    AUDIT_LOG.log_event(
        source="close-workflow",
        user=state.get("user", "analyst_001"),
        action="summary",
        result=status,
        control_mark="CTL-003",
        detail={"flagged_count": flagged, "review_queued": review_queued},
    )
    return {"summary": summary}


def build_close_workflow():
    """Compile the LangGraph close workflow."""
    graph = StateGraph(CloseState)
    graph.add_node("extract", _extract)
    graph.add_node("flag_and_draft", _flag_and_draft)
    graph.add_node("approval_gate", _approval_gate)
    graph.add_node("summary", _summary)
    graph.set_entry_point("extract")
    graph.add_edge("extract", "flag_and_draft")
    graph.add_edge("flag_and_draft", "approval_gate")
    graph.add_edge("approval_gate", "summary")
    graph.add_edge("summary", END)
    return graph.compile()


def run_close_workflow(
    *,
    entity: str | None = None,
    policy_path: str | Path | None = None,
    user: str = "analyst_001",
    approval_status: bool = True,
) -> dict[str, Any]:
    """Execute the close workflow and return the summary payload."""
    app = build_close_workflow()
    initial: CloseState = {
        "entity": entity,
        "policy_path": str(policy_path) if policy_path else None,
        "user": user,
        "approval_status": approval_status,
    }
    final = app.invoke(initial)
    summary = final.get("summary") or {}
    return {
        "disclaimer": summary.get("disclaimer"),
        "status": summary.get("status"),
        "summary": summary.get("summary"),
        "flagged_count": summary.get("flagged_count"),
        "review_queued": summary.get("review_queued"),
        "control_checks": summary.get("control_checks") or [],
        "citations": summary.get("citations") or [],
        "approval": summary.get("approval") or {},
        "close_pass": summary.get("close_pass") or {},
        "context": final.get("context") or {},
    }
