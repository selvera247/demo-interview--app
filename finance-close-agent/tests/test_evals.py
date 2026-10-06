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
