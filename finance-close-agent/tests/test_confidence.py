"""Slice 4: confidence labels, unsupported-JE rule, citation requirements."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from policy import flag_variances, load_policy  # noqa: E402
from tools import (  # noqa: E402
    draft_flux_commentary,
    list_review_queue,
    reset_policy_cache,
    update_review_item,
)

DB_PATH = ROOT / "data" / "finance.db"
DEFAULT_POLICY = ROOT / "config" / "policy.yaml"

# Primary anomaly periods (explainable vs A4)
EXPLAINABLE = [
    ("A1", "6110", "ND-US", "2026-06", "2026-05"),
    ("A2", "6020", "ND-EU", "2026-07", "2026-06"),
    ("A2B", "6500", "ND-EU", "2026-07", "2026-06"),
    ("A3", "4000", "ND-US", "2026-06", "2026-05"),
    ("A3B", "4000", "ND-US", "2026-07", "2026-06"),
    ("B1", "6200", "ND-US", "2026-09", "2026-08"),
    ("B2", "6600", "ND-US", "2026-03", "2026-02"),
]


@pytest.fixture(scope="module")
def db_ready():
    if not DB_PATH.exists():
        pytest.skip("data/finance.db missing — run python generate_data.py")
    reset_policy_cache()
    # Clear review queue between module runs via regenerate is heavy; delete rows
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM review_queue")
    conn.commit()
    conn.close()
    yield
    reset_policy_cache()


def test_a4_low_and_queued_even_at_one_million_threshold(db_ready, tmp_path):
    raw = yaml.safe_load(DEFAULT_POLICY.read_text(encoding="utf-8"))
    raw["variance"]["threshold_amt"] = 1_000_000
    path = tmp_path / "policy_1m.yaml"
    path.write_text(yaml.safe_dump(raw), encoding="utf-8")

    policy = load_policy(path)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    flagged = flag_variances(policy, conn)
    conn.close()
    keys = {(f["entity"], f["account_id"], f["period_b"]) for f in flagged}
    assert ("ND-US", "6310", "2026-09") in keys

    reset_policy_cache()
    draft = draft_flux_commentary(
        "6310",
        entity="ND-US",
        period="2026-09",
        prior_period="2026-08",
        policy=policy,
    )
    assert draft["confidence"] == "low"
    assert draft["status"] == "queued_for_review"
    assert draft["unsupported_je"] is True
    assert draft.get("review_item_id")


def test_explainable_anomalies_are_not_low(db_ready):
    policy = load_policy(DEFAULT_POLICY)
    for _label, account, entity, period, prior in EXPLAINABLE:
        reset_policy_cache()
        draft = draft_flux_commentary(
            account,
            entity=entity,
            period=period,
            prior_period=prior,
            policy=policy,
        )
        assert draft["confidence"] in {"high", "med"}, (
            f"{account} {entity} {period} expected not low, got {draft['confidence']}"
        )
        assert draft["confidence"] != "low"


def test_low_never_auto_approved_without_human_action(db_ready):
    policy = load_policy(DEFAULT_POLICY)
    reset_policy_cache()
    draft = draft_flux_commentary(
        "6310",
        entity="ND-US",
        period="2026-09",
        prior_period="2026-08",
        policy=policy,
    )
    assert draft["confidence"] == "low"
    assert draft["status"] != "approved"
    item_id = draft["review_item_id"]
    assert item_id

    # Agent-queued row is pending
    pending = list_review_queue("pending")["items"]
    assert any(i["item_id"] == item_id and i["status"] == "pending" for i in pending)

    # Approve without reviewer note is rejected
    blocked = update_review_item(item_id, "approved", reviewer_note="")
    assert blocked.get("error") == "human_action_required"

    # Human action with note allows approve
    ok = update_review_item(item_id, "approved", reviewer_note="Reviewed blank JE; reverse.")
    assert ok.get("status") == "approved"
    assert ok.get("error") is None


def test_explainable_commentary_cites_transaction_ids(db_ready):
    policy = load_policy(DEFAULT_POLICY)
    for _label, account, entity, period, prior in EXPLAINABLE:
        reset_policy_cache()
        draft = draft_flux_commentary(
            account,
            entity=entity,
            period=period,
            prior_period=prior,
            policy=policy,
        )
        assert draft["citations"], f"missing citations for {account} {period}"
        assert any(
            cid in draft["commentary"] for cid in draft["citations"]
        ), f"commentary must cite txn for {account}"
