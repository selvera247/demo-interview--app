"""Eval harness: incomplete answer keys must not be scored."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from evals.run_evals import (  # noqa: E402
    CASES_PATH,
    find_incomplete,
    incomplete_fields,
    load_cases,
    normalize_text,
)


def test_cases_yaml_exists():
    assert CASES_PATH.exists(), f"missing {CASES_PATH}"


def test_cases_have_required_structure():
    cases = load_cases(CASES_PATH)
    assert len(cases) >= 17  # 9 planted + ≥8 adversarial
    ids = [c.get("id") for c in cases]
    for required in ("A1", "A2", "A2B", "A3", "A3B", "A4", "B1", "B2", "C1"):
        assert required in ids, f"missing planted case {required}"
    for case in cases:
        assert case.get("id"), "case missing id"
        assert case.get("account"), f"{case.get('id')} missing account"
        assert case.get("entity"), f"{case.get('id')} missing entity"
        assert case.get("period"), f"{case.get('id')} missing period"
        assert "expected_flagged" in case, f"{case.get('id')} missing expected_flagged"


def test_incomplete_answer_key_blocks_scoring():
    """Fail while expected_explanation or required_facts are still blank.

    This is intentional: incomplete stubs must not produce a published score.
    Fill the answer key in cases.yaml, then this test turns green.
    """
    cases = load_cases(CASES_PATH)
    incomplete = find_incomplete(cases)
    assert not incomplete, (
        "evals/cases.yaml still has blank expected_explanation and/or "
        f"required_facts on: {incomplete}. Fill the answer key before scoring."
    )


def test_incomplete_fields_helper_detects_blanks():
    assert incomplete_fields(
        {"expected_explanation": "", "required_facts": []}
    ) == ["expected_explanation", "required_facts"]
    assert incomplete_fields(
        {
            "expected_explanation": "duplicate accrual",
            "required_facts": ["ACCR-CLOUD-6110-DUP"],
        }
    ) == []
    # false-positive-only stubs need no written explanation yet
    assert (
        incomplete_fields(
            {
                "expected_flagged": False,
                "expected_explanation": "",
                "required_facts": [],
            }
        )
        == []
    )


def test_normalize_text_amount_formatting():
    assert normalize_text("$85,000") == normalize_text("85,000")
    assert "85000" in normalize_text("accrual of $85,000 posted")
    assert normalize_text("85,000") in normalize_text("accrual of $85,000 posted")


def test_fact_matches_or_alternatives_and_tolerance():
    from evals.run_evals import fact_matches

    assert fact_matches("timing|early", "Revenue timing JE", 500)
    assert fact_matches("2026-07|July", "start 2026-07-01", 500)
    assert fact_matches("70,000", "moved (+70,174)", 500)
    assert not fact_matches("70,000", "moved (+72,000)", 500)
    # split invoices summing to target
    assert fact_matches(
        "75,000",
        "line A (37,500). line B (37,500).",
        500,
    )
