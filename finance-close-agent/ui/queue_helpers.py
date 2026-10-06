"""Shared review-queue display helpers (no Streamlit dependency)."""

from __future__ import annotations

import json
import re

CONF_ORDER = {"low": 0, "med": 1, "high": 2}
CITATION_RE = re.compile(
    r"Citations:\s*(.+?)\.\s*(?:LOW CONFIDENCE|$)", re.I | re.S
)


def parse_citations(commentary: str) -> list[str]:
    if not commentary:
        return []
    m = CITATION_RE.search(commentary)
    if m:
        return [c.strip() for c in m.group(1).split(",") if c.strip()]
    return re.findall(r"\b(?:ACCR|JE|SW|CONF|HIRING)[A-Z0-9_-]+\b", commentary)


def pass_index(last_pass: dict | None) -> dict:
    index: dict = {}
    if not last_pass:
        return index
    for row in last_pass.get("flagged") or []:
        index[(row["entity"], row["account_id"], row["period_b"])] = dict(row)
    for draft in last_pass.get("drafts") or []:
        key = (draft.get("entity"), draft.get("account"), draft.get("period"))
        if key in index:
            index[key] = {**index[key], **draft}
        else:
            index[key] = dict(draft)
    return index


def policy_rule_for(item: dict, index: dict) -> str:
    key = (item.get("entity"), item.get("account_id"), item.get("period"))
    meta = index.get(key) or {}
    reason = meta.get("flag_reason")
    if reason:
        return reason
    commentary = (
        item.get("edited_commentary") or item.get("draft_commentary") or ""
    ).lower()
    if "unsupported" in commentary or meta.get("unsupported_je"):
        return "unsupported_je"
    return "threshold"


def sort_queue(items: list[dict]) -> list[dict]:
    def key(it: dict):
        conf = str(it.get("confidence") or "high").lower()
        return (CONF_ORDER.get(conf, 9), -abs(float(it.get("variance_amt") or 0)))

    return sorted(items, key=key)


def served_item_label(arguments: str | dict, index: dict) -> str:
    try:
        args = json.loads(arguments) if isinstance(arguments, str) else (arguments or {})
    except (TypeError, json.JSONDecodeError):
        args = {}
    account = args.get("account") or args.get("account_id")
    entity = args.get("entity")
    period = args.get("period") or args.get("period_b")
    if account and entity:
        for (e, a, p), meta in index.items():
            if e == entity and a == account and (period is None or p == period):
                conf = meta.get("confidence", "?")
                return f"{entity} {account} {p} ({conf})"
        if period:
            return f"{entity} {account} {period}"
        return f"{entity} {account}"
    if account:
        return f"account={account}"
    return args.get("period") or args.get("period_a") or "—"
