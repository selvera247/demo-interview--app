"""Heuristic provider — wraps structural assess_flux (no network)."""

from __future__ import annotations

import json
from typing import Any

from llm import LLMProvider


class HeuristicProvider(LLMProvider):
    name = "heuristic"

    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or {}

    def generate(
        self,
        system: str,
        user: str,
        json_schema: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Parse the user payload (JSON) and run structural assess_flux offline.

        Prefer pre-computed residual/explained from the drafting layer when present.
        """
        from policy import load_policy
        from tools import assess_flux

        try:
            payload = json.loads(user)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"heuristic user payload must be JSON: {exc}") from exc

        policy = load_policy()
        variance = payload["variance"]
        evidence = payload["evidence"]
        account = payload["account"]
        entity = payload["entity"]
        period = payload["period"]
        prior_period = payload["prior_period"]
        pct_threshold = float(payload.get("pct_threshold") or policy.variance.threshold_pct)

        assessed = assess_flux(
            account,
            entity,
            period,
            prior_period,
            evidence.get("current") or [],
            variance,
            policy,
            pct_threshold,
            evidence=evidence,
        )
        # Prefer drafting-layer precompute when provided (must not diverge).
        explained = payload.get("explained_amount")
        residual = payload.get("residual_amount")
        if explained is None:
            explained = assessed.get("explained_amount")
        if residual is None:
            residual = assessed.get("residual_amount")
        assessed["explained_amount"] = explained
        assessed["residual_amount"] = residual
        return {
            "commentary": assessed["commentary"],
            "cited_ids": list(assessed.get("citations") or []),
            "explained_amount": explained,
            "residual_amount": residual,
            "_heuristic_assessed": assessed,
        }
