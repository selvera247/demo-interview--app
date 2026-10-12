"""Verify LangGraph workflow + FastAPI match the existing close-pass spine."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = ROOT / "data" / "finance.db"

EXPECTED_BREACHES = {
    ("ND-US", "6110", "2026-06"),
    ("ND-EU", "6020", "2026-07"),
    ("ND-EU", "6500", "2026-07"),
    ("ND-US", "4000", "2026-06"),
    ("ND-US", "4000", "2026-07"),
    ("ND-US", "6310", "2026-09"),
    ("ND-US", "6200", "2026-09"),
    ("ND-US", "6600", "2026-03"),
    ("ND-EU", "6100", "2026-08"),
}


@pytest.fixture(scope="module")
def ensure_db():
    if not DB_PATH.exists():
        pytest.skip("data/finance.db missing — run python generate_data.py")
    yield


@pytest.fixture()
def clean_queue(ensure_db):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM review_queue")
    conn.execute("DELETE FROM tool_call_log")
    conn.commit()
    conn.close()
    from audit.logger import AUDIT_LOG

    AUDIT_LOG.clear()
    yield


def test_workflow_matches_close_agent_flag_set(clean_queue):
    from agent.close_agent import run_close_pass
    from workflows.close_workflow import run_close_workflow

    direct = run_close_pass(draft=True)
    # Clear queue writes from direct pass so workflow owns the queue state.
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM review_queue")
    conn.commit()
    conn.close()

    workflow = run_close_workflow(user="pytest")
    assert workflow["flagged_count"] == direct["flagged_count"] == 9
    assert workflow["review_queued"] == direct["review_queued"] == 2
    assert workflow["status"] == "requires_review"

    keys = {
        (r["entity"], r["account_id"], r["period_b"])
        for r in workflow["close_pass"]["flagged"]
    }
    assert keys == EXPECTED_BREACHES

    checks = {c["id"]: c["status"] for c in workflow["control_checks"]}
    assert checks["CTL-001"] == "pass"
    assert checks["CTL-002"] == "pass"
    assert checks["CTL-003"] == "pending_review"


def test_api_health_and_close_pass(clean_queue):
    from fastapi.testclient import TestClient

    from api.main import app

    client = TestClient(app)
    assert client.get("/health/ready").json()["status"] == "ready"
    status = client.get("/workflow/status").json()
    assert "flag_and_draft" in status["stages"]

    resp = client.post("/finance/close-pass", json={"user": "pytest"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["flagged_count"] == 9
    assert body["review_queued"] == 2
    assert body["status"] == "requires_review"

    trail = client.get("/finance/audit-trail").json()
    actions = {e["action"] for e in trail["events"]}
    assert "extract" in actions
    assert "flag_and_draft" in actions
    assert "POST /finance/close-pass" in actions

    queue = client.get("/finance/review-queue").json()
    assert len(queue.get("items") or []) >= 2
