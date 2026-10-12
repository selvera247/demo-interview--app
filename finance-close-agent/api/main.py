#!/usr/bin/env python3
"""FastAPI entrypoint for the Northwind Digital close workflow.

Run from finance-close-agent/:

    uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from audit.logger import AUDIT_LOG  # noqa: E402
from tools import list_review_queue  # noqa: E402
from workflows.close_workflow import run_close_workflow  # noqa: E402

app = FastAPI(
    title="Northwind Digital — Close Workflow API",
    description=(
        "Audit-aware close workflow over synthetic Northwind Digital finance data. "
        "LangGraph stages call the same MCP tool spine used by Claude Desktop."
    ),
    version="1.0.0",
)


class ClosePassRequest(BaseModel):
    """Optional filters for a close workflow run."""

    entity: str | None = Field(
        default=None, description="Entity id (ND-US / ND-EU); omit for all"
    )
    user: str = Field(default="analyst_001", description="Actor for audit trail")
    approval_status: bool = Field(
        default=True,
        description="Caller intent to approve; med/low items still force review",
    )


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "finance-close-agent",
        "company": "Northwind Digital",
        "status": "ok",
        "workflow": "extract → flag_and_draft → approval_gate → summary",
        "disclaimer": "SYNTHETIC DATA — demo only",
    }


@app.get("/health/ready")
def health_ready() -> dict[str, str]:
    return {"status": "ready"}


@app.get("/workflow/status")
def workflow_status() -> dict[str, Any]:
    return {
        "workflow": "close-variance-review",
        "stages": ["extract", "flag_and_draft", "approval_gate", "summary"],
        "spine": ["sqlite", "policy.yaml", "mcp_tools", "streamlit_review", "evals"],
        "auditable": True,
    }


@app.post("/finance/close-pass")
def finance_close_pass(body: ClosePassRequest) -> dict[str, Any]:
    """Run the LangGraph close workflow (same flags as agent/close_agent.py)."""
    result = run_close_workflow(
        entity=body.entity,
        user=body.user,
        approval_status=body.approval_status,
    )
    AUDIT_LOG.log_event(
        source="close-api",
        user=body.user,
        action="POST /finance/close-pass",
        result=result.get("status", "unknown"),
        control_mark="CTL-003",
        detail={
            "entity": body.entity,
            "flagged_count": result.get("flagged_count"),
            "review_queued": result.get("review_queued"),
        },
    )
    return result


@app.get("/finance/audit-trail")
def finance_audit_trail(limit: int = 50) -> dict[str, Any]:
    return {"events": AUDIT_LOG.list_events(limit=limit)}


@app.get("/finance/review-queue")
def finance_review_queue(status: str | None = "pending") -> dict[str, Any]:
    return list_review_queue(status=status)


def main() -> None:
    import uvicorn

    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
