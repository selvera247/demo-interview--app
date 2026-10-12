"""LLM drafting contract tests — mocked providers only (no real API calls)."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from llm import LLMError, get_provider, load_llm_config  # noqa: E402
from llm.heuristic import HeuristicProvider  # noqa: E402
from tools import (  # noqa: E402
    draft_flux_commentary,
    reset_policy_cache,
    set_llm_provider,
    update_review_item,
)


@pytest.fixture(autouse=True)
def _reset_provider():
    set_llm_provider(None)
    reset_policy_cache()
    yield
    set_llm_provider(None)
    reset_policy_cache()


def test_provider_switch_via_config_heuristic():
    p = get_provider("heuristic")
    assert isinstance(p, HeuristicProvider)
    cfg = load_llm_config()
    assert "heuristic" in cfg["providers"]
    assert "openai" in cfg["providers"]
    assert "anthropic" in cfg["providers"]


def test_hallucinated_citation_downgrades_to_low(monkeypatch):
    class FakeProvider:
        name = "fake"

        def generate(self, system, user, json_schema=None):
            return {
                "commentary": "Made-up story about growth.",
                "cited_ids": ["NOT-A-REAL-TXN-ID"],
                "explained_amount": 1,
                "residual_amount": 0,
            }

    import tools as tools_mod
    import llm as llm_mod

    monkeypatch.setattr(llm_mod, "get_provider", lambda name=None: FakeProvider())
    set_llm_provider("fake")
    draft = draft_flux_commentary(
        "6110", entity="ND-US", period="2026-06", prior_period="2026-05"
    )
    assert draft["confidence"] == "low"
    assert "hallucinated_citation" in (draft.get("draft_meta") or {}).get(
        "citation_errors", []
    ) or draft["confidence"] == "low"
    assert draft["draft_meta"]["citation_errors"] == ["NOT-A-REAL-TXN-ID"]
    assert draft["status"] == "queued_for_review"


def test_invalid_json_retries_then_falls_back(monkeypatch):
    calls = {"n": 0}

    class BadThenProvider:
        name = "bad"

        def generate(self, system, user, json_schema=None):
            calls["n"] += 1
            raise LLMError("invalid JSON")

    import llm as llm_mod

    monkeypatch.setattr(llm_mod, "get_provider", lambda name=None: BadThenProvider())
    set_llm_provider("bad")
    draft = draft_flux_commentary(
        "6110", entity="ND-US", period="2026-06", prior_period="2026-05"
    )
    assert calls["n"] == 2
    assert draft["draft_meta"]["fallback"] is True
    assert draft["confidence"] in {"high", "med", "low"}
    assert draft.get("commentary")


def test_low_never_auto_approved_regardless_of_provider(monkeypatch):
    class LowProvider:
        name = "lowfake"

        def generate(self, system, user, json_schema=None):
            return {
                "commentary": "Cannot explain.",
                "cited_ids": [],
                "explained_amount": None,
                "residual_amount": 70000,
            }

    import llm as llm_mod

    monkeypatch.setattr(llm_mod, "get_provider", lambda name=None: LowProvider())
    set_llm_provider("lowfake")
    draft = draft_flux_commentary(
        "6310", entity="ND-US", period="2026-09", prior_period="2026-08"
    )
    assert draft["status"] != "approved"
    item_id = draft.get("review_item_id")
    if item_id:
        blocked = update_review_item(item_id, "approved", reviewer_note="")
        assert blocked.get("error") == "human_action_required"
