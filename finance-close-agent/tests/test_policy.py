"""Tests for config/policy.yaml loading and threshold flagging."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
import sys

sys.path.insert(0, str(ROOT))

from policy import PolicyError, flag_variances, load_policy  # noqa: E402

DB_PATH = ROOT / "data" / "finance.db"
DEFAULT_POLICY = ROOT / "config" / "policy.yaml"

EXPECTED_DEFAULT_BREACHES = {
    ("ND-US", "6110", "2026-06"),
    ("ND-EU", "6020", "2026-07"),
    ("ND-EU", "6500", "2026-07"),
    ("ND-US", "4000", "2026-06"),
    ("ND-US", "4000", "2026-07"),
    ("ND-US", "6310", "2026-09"),
    ("ND-US", "6200", "2026-09"),
    ("ND-US", "6600", "2026-03"),
}


@pytest.fixture(scope="module")
def db_conn():
    if not DB_PATH.exists():
        pytest.skip("data/finance.db missing — run python generate_data.py")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    yield conn
    conn.close()


def _breach_keys(flagged):
    return {(f["entity"], f["account_id"], f["period_b"]) for f in flagged}


def test_default_policy_flags_exactly_eight_breaches(db_conn):
    policy = load_policy(DEFAULT_POLICY)
    flagged = flag_variances(policy, db_conn)
    assert _breach_keys(flagged) == EXPECTED_DEFAULT_BREACHES
    assert len(flagged) == 8


def test_raising_dollar_threshold_changes_flagged_set(db_conn, tmp_path):
    raw = yaml.safe_load(DEFAULT_POLICY.read_text(encoding="utf-8"))
    raw["variance"]["threshold_amt"] = 100_000
    path = tmp_path / "policy_100k.yaml"
    path.write_text(yaml.safe_dump(raw), encoding="utf-8")

    flagged = flag_variances(load_policy(path), db_conn)
    keys = _breach_keys(flagged)

    # A4 (~70k), B1 (~78k), B2 (~56k) drop; A1/A2/A2B/A3/A3B remain
    assert ("ND-US", "6310", "2026-09") not in keys
    assert ("ND-US", "6200", "2026-09") not in keys
    assert ("ND-US", "6600", "2026-03") not in keys
    assert ("ND-US", "6110", "2026-06") in keys
    assert ("ND-US", "4000", "2026-06") in keys
    assert keys != EXPECTED_DEFAULT_BREACHES


def test_per_account_override_works(db_conn, tmp_path):
    raw = yaml.safe_load(DEFAULT_POLICY.read_text(encoding="utf-8"))
    # Raise Marketing threshold so B1 no longer flags
    raw["account_overrides"] = {
        "6200": {"threshold_pct": 0.10, "threshold_amt": 200_000, "require_both": True}
    }
    path = tmp_path / "policy_override.yaml"
    path.write_text(yaml.safe_dump(raw), encoding="utf-8")

    flagged = flag_variances(load_policy(path), db_conn)
    keys = _breach_keys(flagged)
    assert ("ND-US", "6200", "2026-09") not in keys
    assert ("ND-US", "6310", "2026-09") in keys  # A4 still flags under defaults
    assert len(keys) == 7


def test_invalid_yaml_fails_loudly(tmp_path):
    path = tmp_path / "bad_policy.yaml"
    path.write_text(
        "variance: []\naccount_overrides: {}\nconfidence:\n  high_min: 0.8\n"
        "  med_min: 0.55\n  low_routes_to_human_review: true\n",
        encoding="utf-8",
    )
    with pytest.raises(PolicyError, match="variance"):
        load_policy(path)


def test_missing_keys_fail_loudly(tmp_path):
    path = tmp_path / "incomplete.yaml"
    path.write_text(
        yaml.safe_dump({"variance": {"threshold_pct": 0.1}, "account_overrides": {}}),
        encoding="utf-8",
    )
    with pytest.raises(PolicyError, match="missing required keys"):
        load_policy(path)


def test_missing_file_fails_loudly(tmp_path):
    with pytest.raises(PolicyError, match="not found"):
        load_policy(tmp_path / "nope.yaml")
