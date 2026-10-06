"""Drafting prompt + schema for LLM flux commentary."""

from __future__ import annotations

import json
from typing import Any

DRAFT_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["commentary", "cited_ids", "explained_amount", "residual_amount"],
    "properties": {
        "commentary": {"type": "string"},
        "cited_ids": {"type": "array", "items": {"type": "string"}},
        "explained_amount": {"type": ["number", "null"]},
        "residual_amount": {"type": ["number", "null"]},
    },
}

SYSTEM_PROMPT = """You are a finance close assistant drafting MoM flux commentary.
You may ONLY use the retrieved subledger evidence provided in the user message.
Return a single JSON object with keys:
  commentary (string),
  cited_ids (array of txn_id strings from the evidence),
  explained_amount (number or null),
  residual_amount (number or null).

Rules:
- If evidence is missing or insufficient, say you cannot explain the variance.
- Never speculate on causes that are not supported by the retrieved rows.
- If part of the variance is unexplained, state the unexplained residual amount.
- cited_ids must be txn_id values that appear in the evidence; do not invent IDs.
- Do not invent vendors, contracts, or amounts not present in the evidence.
"""


def build_user_payload(
    account: str,
    entity: str,
    period: str,
    prior_period: str,
    variance: dict[str, Any],
    evidence: dict[str, Any],
    pct_threshold: float,
) -> str:
    slim_evidence = {
        "current": evidence.get("current") or [],
        "prior": evidence.get("prior") or [],
        "counterparts": evidence.get("counterparts") or {},
        "evidence_txn_ids": evidence.get("evidence_txn_ids") or [],
    }
    payload = {
        "account": account,
        "entity": entity,
        "period": period,
        "prior_period": prior_period,
        "pct_threshold": pct_threshold,
        "variance": {
            "account_name": variance.get("account_name"),
            "variance_pct": variance.get("variance_pct"),
            "variance_amt": variance.get("variance_amt"),
            "balance_a": variance.get("balance_a"),
            "balance_b": variance.get("balance_b"),
        },
        "evidence": slim_evidence,
    }
    return json.dumps(payload, default=str)
