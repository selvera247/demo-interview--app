"""Finance MCP tool implementations (shared by MCP server and local agent)."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from db import connect, get_meta, log_tool_call, rows_to_dicts
from policy import Policy, load_policy

_POLICY: Policy | None = None

_UNMATCHED_RE = re.compile(
    r"no\s+po|no\s+matching\s+contract|unmatched|unexplained|no\s+vendor",
    re.I,
)
_CONTRACT_PO_RE = re.compile(
    r"\b(CTR-[A-Z0-9-]+|contract|PO\b|P\.O\.|purchase order|license|renewal)\b",
    re.I,
)
_TIMING_RE = re.compile(
    r"(premature|revers(?:e|al|ing)?|timing|start\s+\d{4}-\d{2}|contract starts)",
    re.I,
)
_PLANNED_RE = re.compile(
    r"(conference|summit|hiring|staffing|agency|retainer|advisory|"
    r"leadership|training program|planned|installment)",
    re.I,
)
_REF_TOKEN_RE = re.compile(r"\b([A-Z]{2,}[-_][A-Z0-9][-A-Z0-9_]*)\b")


def get_policy(policy: Policy | None = None) -> Policy:
    """Return explicit policy, or a process-wide cached default policy."""
    global _POLICY
    if policy is not None:
        return policy
    if _POLICY is None:
        _POLICY = load_policy()
    return _POLICY


def reset_policy_cache() -> None:
    global _POLICY
    _POLICY = None


_LLM_PROVIDER_NAME: str | None = None


def set_llm_provider(name: str | None) -> None:
    """Select LLM provider for draft_flux_commentary (None = config default)."""
    global _LLM_PROVIDER_NAME
    _LLM_PROVIDER_NAME = name


def get_llm_provider_name() -> str | None:
    return _LLM_PROVIDER_NAME


def _summary(payload: Any, limit: int = 180) -> str:
    text = json.dumps(payload, default=str)
    return text if len(text) <= limit else text[: limit - 3] + "..."


def get_trial_balance(period: str, entity: str = "US-01") -> dict:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT t.account_id, a.name, a.account_type, a.statement, t.ending_balance
            FROM trial_balance t
            JOIN accounts a ON a.account_id = t.account_id
            WHERE t.period = ? AND t.entity = ?
            ORDER BY t.account_id
            """,
            (period, entity),
        ).fetchall()
        payload = {
            "disclaimer": get_meta(conn, "disclaimer"),
            "period": period,
            "entity": entity,
            "accounts": rows_to_dicts(rows),
        }
        log_tool_call(conn, "get_trial_balance", {"period": period, "entity": entity}, _summary(payload))
        return payload


def get_account_variance(
    account: str,
    period_a: str,
    period_b: str,
    entity: str = "US-01",
    policy: Policy | None = None,
) -> dict:
    pol = get_policy(policy)
    thr = pol.thresholds_for(account)
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT period, ending_balance
            FROM trial_balance
            WHERE account_id = ? AND entity = ? AND period IN (?, ?)
            """,
            (account, entity, period_a, period_b),
        ).fetchall()
        by_period = {r["period"]: r["ending_balance"] for r in rows}
        a = by_period.get(period_a)
        b = by_period.get(period_b)
        if a is None or b is None:
            payload = {
                "error": "missing_balance",
                "account": account,
                "period_a": period_a,
                "period_b": period_b,
                "entity": entity,
            }
            log_tool_call(
                conn,
                "get_account_variance",
                {"account": account, "period_a": period_a, "period_b": period_b, "entity": entity},
                _summary(payload),
            )
            return payload

        delta = b - a
        pct = (delta / a) if abs(a) > 1 else (1.0 if abs(delta) else 0.0)
        name = conn.execute(
            "SELECT name FROM accounts WHERE account_id = ?", (account,)
        ).fetchone()
        payload = {
            "disclaimer": get_meta(conn, "disclaimer"),
            "account": account,
            "account_name": name["name"] if name else account,
            "entity": entity,
            "period_a": period_a,
            "period_b": period_b,
            "balance_a": a,
            "balance_b": b,
            "variance_amt": round(delta, 2),
            "variance_pct": round(pct, 4),
            "over_threshold": pol.is_over_threshold(account, pct, delta),
            "threshold_pct": thr.threshold_pct,
            "threshold_amt": thr.threshold_amt,
        }
        log_tool_call(
            conn,
            "get_account_variance",
            {"account": account, "period_a": period_a, "period_b": period_b, "entity": entity},
            _summary(payload),
        )
        return payload


def get_subledger_detail(account: str, period: str, entity: str = "US-01") -> dict:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT s.txn_id, s.txn_date, s.party_id, p.name AS party_name,
                   s.memo, s.amount, s.source_system, s.entry_type
            FROM subledger s
            LEFT JOIN parties p ON p.party_id = s.party_id
            WHERE s.account_id = ? AND s.period = ? AND s.entity = ?
            ORDER BY s.txn_date, s.txn_id
            """,
            (account, period, entity),
        ).fetchall()
        payload = {
            "disclaimer": get_meta(conn, "disclaimer"),
            "account": account,
            "period": period,
            "entity": entity,
            "transactions": rows_to_dicts(rows),
            "txn_count": len(rows),
            "net_amount": round(sum(r["amount"] for r in rows), 2),
        }
        log_tool_call(
            conn,
            "get_subledger_detail",
            {"account": account, "period": period, "entity": entity},
            _summary(payload),
        )
        return payload


def list_open_close_tasks(period: str | None = None, entity: str | None = None) -> dict:
    with connect() as conn:
        as_of = period or get_meta(conn, "as_of_period")
        sql = "SELECT * FROM close_tasks WHERE period = ?"
        params: list[Any] = [as_of]
        if entity:
            sql += " AND entity = ?"
            params.append(entity)
        sql += " ORDER BY due_day, task_id"
        rows = conn.execute(sql, params).fetchall()
        open_rows = [r for r in rows if r["status"] != "done"]
        payload = {
            "disclaimer": get_meta(conn, "disclaimer"),
            "period": as_of,
            "entity": entity,
            "tasks": rows_to_dicts(rows),
            "open_count": len(open_rows),
        }
        log_tool_call(
            conn,
            "list_open_close_tasks",
            {"period": as_of, "entity": entity},
            _summary(payload),
        )
        return payload


def _memo_refs(memo: str) -> set[str]:
    return set(_REF_TOKEN_RE.findall(memo or ""))


def _is_unmatched_row(txn: dict[str, Any]) -> bool:
    return bool(_UNMATCHED_RE.search(txn.get("memo") or ""))


def _is_timing_row(txn: dict[str, Any]) -> bool:
    return bool(_TIMING_RE.search(txn.get("memo") or ""))


def _is_contract_or_po_row(txn: dict[str, Any]) -> bool:
    if _is_unmatched_row(txn):
        return False
    return bool(_CONTRACT_PO_RE.search(txn.get("memo") or ""))


def _is_planned_labeled_row(txn: dict[str, Any]) -> bool:
    """Labeled planned spend (conference/hiring/etc.) with a memo reference."""
    if _is_unmatched_row(txn):
        return False
    memo = txn.get("memo") or ""
    if not _PLANNED_RE.search(memo):
        return False
    return bool(_memo_refs(memo)) or bool(memo.strip())


def _has_reclass_pair(
    txn: dict[str, Any],
    counterparts: dict[str, list[dict[str, Any]]],
) -> bool:
    if (txn.get("entry_type") or "").strip() == "reclass":
        return True
    memo = (txn.get("memo") or "").lower()
    if "reclass" in memo:
        return True
    amt = float(txn.get("amount") or 0)
    if abs(amt) < 0.005:
        return False
    for rows in counterparts.values():
        for other in rows:
            if abs(float(other.get("amount") or 0) + amt) < 1.0:
                return True
    return False


def _same_reference_or_identical_memo(a: dict[str, Any], b: dict[str, Any]) -> bool:
    ma = (a.get("memo") or "").strip()
    mb = (b.get("memo") or "").strip()
    if ma and mb and ma == mb:
        return True
    ra, rb = _memo_refs(ma), _memo_refs(mb)
    if ra and rb and (ra & rb):
        return True
    return False


def _is_planned_split_pair(a: dict[str, Any], b: dict[str, Any]) -> bool:
    """Different memos describing planned split spend ⇒ not a duplicate.

    Same party/amount alone is insufficient. Identical memos are still
    duplicate candidates; differing conference/hiring/etc. memos are not.
    """
    ma = (a.get("memo") or "").strip()
    mb = (b.get("memo") or "").strip()
    if ma and mb and ma == mb:
        return False
    combined = f"{ma} {mb}"
    return bool(_PLANNED_RE.search(combined))


def _find_duplicate_groups(current: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """Duplicates require same party, same amount, AND same ref or identical memo."""
    by_key: dict[tuple[str, float], list[dict[str, Any]]] = {}
    for t in current:
        party = (t.get("party_id") or "").strip()
        if not party:
            continue
        amt = round(float(t.get("amount") or 0), 2)
        if abs(amt) < 1000:
            continue
        by_key.setdefault((party, amt), []).append(t)

    groups: list[list[dict[str, Any]]] = []
    for (_party, _amt), candidates in by_key.items():
        if len(candidates) < 2:
            continue
        used: set[int] = set()
        for i, a in enumerate(candidates):
            if i in used:
                continue
            cluster = [a]
            used.add(i)
            for j, b in enumerate(candidates):
                if j in used:
                    continue
                if _is_planned_split_pair(a, b):
                    continue
                if _same_reference_or_identical_memo(a, b):
                    cluster.append(b)
                    used.add(j)
            if len(cluster) >= 2:
                groups.append(cluster)
    return groups


def _find_near_amount_pairs(
    current: list[dict[str, Any]],
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    """Same party, amounts within $500, different refs — cite for review, not duplicate."""
    keyed: list[tuple[str, float, dict[str, Any]]] = []
    for t in current:
        party = (t.get("party_id") or "").strip()
        if not party:
            continue
        keyed.append((party, float(t.get("amount") or 0), t))
    pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []
    used: set[str] = set()
    for i, (p1, a1, t1) in enumerate(keyed):
        for p2, a2, t2 in keyed[i + 1 :]:
            if p1 != p2:
                continue
            if not (0 < abs(abs(a1) - abs(a2)) <= 500):
                continue
            if _same_reference_or_identical_memo(t1, t2):
                continue
            ids = tuple(sorted([t1["txn_id"], t2["txn_id"]]))
            key = "|".join(ids)
            if key in used:
                continue
            used.add(key)
            pairs.append((t1, t2))
    return pairs


def assess_flux(
    account: str,
    entity: str,
    period: str,
    prior_period: str,
    txns: list[dict[str, Any]],
    variance: dict[str, Any],
    policy: Policy,
    pct_threshold: float,
    evidence: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Score evidence with residual accounting (no planted IDs / dollar-rank coverage).

    General rules (from first honest heuristic eval):
      - residual = variance − sum(supported row amounts); no ranking by dollar size
      - supported = contract/PO match, reclass pair, true duplicate excess, timing JE,
        or planned labeled spend
      - every unmatched/unsupported row is cited and labeled unexplained
      - high only if |residual| ≤ policy residual_tolerance_amt; med if residual with
        some support; low if no support or unsupported_je — coverage % never raises
      - duplicates need same party, amount, AND same ref/identical memo
      - timing/reversal JEs are cited before routine billing
    """
    thr = policy.thresholds_for(account)
    flags: list[str] = []
    citations: list[str] = []
    driver_lines: list[str] = []

    current = list(txns)
    if evidence is not None:
        current = list(evidence.get("current") or txns)
    counterparts: dict[str, list[dict[str, Any]]] = (
        (evidence or {}).get("counterparts") or {}
    )

    var_amt = float(variance.get("variance_amt") or 0)

    unsupported_txns = [t for t in current if policy.is_unsupported_txn(t)]
    unmatched_txns = [
        t for t in current if _is_unmatched_row(t) and t not in unsupported_txns
    ]

    dup_groups = _find_duplicate_groups(current)
    dup_member_ids = {t["txn_id"] for g in dup_groups for t in g}

    timing_rows = [t for t in current if _is_timing_row(t)]
    reclass_rows = [t for t in current if _has_reclass_pair(t, counterparts)]
    contract_rows = [
        t
        for t in current
        if _is_contract_or_po_row(t)
        and t["txn_id"] not in {x["txn_id"] for x in timing_rows}
        and t["txn_id"] not in dup_member_ids
        and not _is_unmatched_row(t)
    ]
    planned_rows = [
        t
        for t in current
        if _is_planned_labeled_row(t)
        and t["txn_id"] not in {x["txn_id"] for x in timing_rows}
        and t["txn_id"] not in {x["txn_id"] for x in contract_rows}
        and t["txn_id"] not in dup_member_ids
        and t["txn_id"] not in {x["txn_id"] for x in reclass_rows}
        and not _is_unmatched_row(t)
    ]

    # --- Explained amount from supported rows (not dollar-rank coverage) ---
    explained = 0.0
    supported_ids: list[str] = []

    if dup_groups:
        flags.append("possible_duplicate_je")
        for group in dup_groups:
            amt = float(group[0].get("amount") or 0)
            # Excess copies explain the MoM bump (n-1), not both sides of sticky base
            excess = amt * (len(group) - 1)
            explained += excess
            for t in group:
                supported_ids.append(t["txn_id"])
                citations.append(t["txn_id"])
                driver_lines.append(
                    f"{t['txn_id']} ({t.get('party_name') or t.get('party_id')}: "
                    f"{amt:,.0f}) matches another posting with the same party, "
                    f"amount, and reference/memo."
                )
            driver_lines.append(
                f"Identical same-party/reference postings indicate a duplicate "
                f"accrual explaining {abs(excess):,.0f} of the variance."
            )

    for t in timing_rows:
        explained += float(t.get("amount") or 0)
        supported_ids.append(t["txn_id"])
        citations.append(t["txn_id"])
        driver_lines.append(
            f"{t['txn_id']}: timing/reversal JE — {t.get('memo') or '(blank)'} "
            f"({float(t['amount']):,.0f})."
        )
        flags.append("timing_or_reversal_je")

    for t in reclass_rows:
        if t["txn_id"] in supported_ids:
            continue
        explained += float(t.get("amount") or 0)
        supported_ids.append(t["txn_id"])
        citations.append(t["txn_id"])
        driver_lines.append(
            f"{t['txn_id']}: reclass pair — {t.get('memo') or '(blank)'} "
            f"({float(t['amount']):,.0f})."
        )
        flags.append("paired_offset_activity")

    # Cite counterpart reclass legs so both sides of a pair are visible
    if counterparts and (reclass_rows or any("reclass" in (t.get("memo") or "").lower() for t in current)):
        flags.append("paired_offset_activity")
        for other_acct, rows in counterparts.items():
            for t in rows:
                memo = (t.get("memo") or "").lower()
                et = (t.get("entry_type") or "").strip()
                if et == "reclass" or "reclass" in memo:
                    citations.append(t["txn_id"])
                    if t["txn_id"] not in supported_ids:
                        driver_lines.append(
                            f"Paired reclass on {other_acct}: {t['txn_id']} "
                            f"({t.get('memo') or 'no memo'}: {t['amount']:,.0f})."
                        )

    for t in contract_rows:
        if t["txn_id"] in supported_ids:
            continue
        explained += float(t.get("amount") or 0)
        supported_ids.append(t["txn_id"])
        citations.append(t["txn_id"])
        driver_lines.append(
            f"{t['txn_id']}: contract/PO-supported — {t.get('memo') or '(blank)'} "
            f"({float(t['amount']):,.0f})."
        )
        flags.append("contract_or_po_support")

    for t in planned_rows:
        if t["txn_id"] in supported_ids:
            continue
        explained += float(t.get("amount") or 0)
        supported_ids.append(t["txn_id"])
        citations.append(t["txn_id"])
        driver_lines.append(
            f"{t['txn_id']}: planned labeled spend — {t.get('memo') or '(blank)'} "
            f"({float(t['amount']):,.0f})."
        )
        flags.append("planned_labeled_spend")

    # Near-identical amounts with different refs: cite for review, do not treat as dup,
    # and do not count toward explained (coverage must not raise confidence).
    if "possible_duplicate_je" not in flags:
        for t1, t2 in _find_near_amount_pairs(current):
            flags.append("near_amount_review")
            for t in (t1, t2):
                citations.append(t["txn_id"])
                driver_lines.append(
                    f"{t['txn_id']}: near-identical same-party amount with a different "
                    f"reference ({t.get('memo') or 'no memo'}: {float(t['amount']):,.0f}); "
                    f"not treated as a duplicate."
                )

    residual = round(var_amt - explained, 2)

    # --- Unmatched / unsupported: always cite + label unexplained ---
    if unsupported_txns:
        flags.append("unsupported_je")
        for t in unsupported_txns:
            citations.append(t["txn_id"])
            driver_lines.append(
                f"{t['txn_id']} is unsupported (blank description and/or no vendor); "
                f"unexplained amount {float(t['amount']):,.0f}."
            )

    for t in unmatched_txns:
        citations.append(t["txn_id"])
        driver_lines.append(
            f"{t['txn_id']} is unmatched/unexplained "
            f"({t.get('memo') or 'no memo'}: {float(t['amount']):,.0f})."
        )
        flags.append("unmatched_unexplained")

    # If residual remains with no unmatched row to carry it, state the residual
    if (
        abs(residual) > policy.confidence.residual_tolerance_amt
        and not unmatched_txns
        and not unsupported_txns
        and supported_ids
    ):
        driver_lines.append(
            f"Unexplained residual amount {residual:,.0f} after supported evidence."
        )
        flags.append("residual_after_support")

    citations = list(dict.fromkeys(c for c in citations if c))
    flags = list(dict.fromkeys(flags))
    has_support = bool(supported_ids)
    unsupported_flag = bool(unsupported_txns)
    has_unmatched = bool(unmatched_txns)

    # Residual-based confidence; coverage % never raises. Any unmatched row
    # means a residual exists → at most med when some support is present.
    if unsupported_flag or not has_support:
        confidence: str = "low"
    elif has_unmatched or abs(residual) > policy.confidence.residual_tolerance_amt:
        confidence = "med"
    else:
        confidence = "high"
    # Legacy score mirror for exports / UI (not used to raise confidence)
    evidence_score = {"high": 0.92, "med": 0.65, "low": 0.0}[confidence]

    if not citations:
        flags.append("no_citations")
        confidence = "low"
        evidence_score = 0.0
        if not driver_lines:
            driver_lines.append(
                "No citable subledger transactions; confidence capped at low."
            )

    if not driver_lines:
        flags.append("needs_human_review")
        confidence = "low"
        evidence_score = 0.0
        driver_lines.append(
            "No clear subledger driver; marking for human review rather than guessing."
        )

    if abs(residual) <= policy.confidence.residual_tolerance_amt and has_support:
        flags.append("residual_within_tolerance")
    elif has_support and abs(residual) > policy.confidence.residual_tolerance_amt:
        flags.append("partial_subledger_coverage")

    over = abs(variance["variance_pct"]) > pct_threshold and abs(
        variance["variance_amt"]
    ) > thr.threshold_amt

    commentary = (
        f"{variance['account_name']} ({account}) moved {variance['variance_pct']:.1%} "
        f"({variance['variance_amt']:+,.0f}) from {prior_period} to {period}. "
        + " ".join(driver_lines)
    )
    if citations:
        commentary += " Citations: " + ", ".join(citations) + "."
    if confidence == "low" and policy.confidence.low_routes_to_human_review:
        commentary += " LOW CONFIDENCE — queued for human review (no auto-approve)."

    route_review = (
        confidence in {"low", "med"} and policy.confidence.low_routes_to_human_review
    ) or (unsupported_flag and policy.unsupported_je.always_route_to_human_review)
    status = "queued_for_review" if route_review else "draft_ready"
    if status == "approved":  # pragma: no cover — hard guard
        raise RuntimeError("agent must never auto-approve")

    return {
        "confidence": confidence,
        "evidence_score": evidence_score,
        "flags": flags,
        "citations": citations,
        "commentary": commentary,
        "over_threshold": over,
        "unsupported_je": unsupported_flag,
        "status": status,
        "threshold_pct": pct_threshold,
        "threshold_amt": thr.threshold_amt,
        "explained_amount": round(explained, 2),
        "residual_amount": residual,
        "supported_txn_ids": list(dict.fromkeys(supported_ids)),
        "unexplained_txn_ids": [
            t["txn_id"] for t in unmatched_txns + unsupported_txns
        ],
    }


def draft_flux_commentary(
    account: str,
    threshold: float | None = None,
    entity: str = "US-01",
    period: str | None = None,
    prior_period: str | None = None,
    policy: Policy | None = None,
) -> dict:
    """Draft flux commentary from subledger drivers; queue low-confidence items.

    `threshold` optionally overrides policy percent threshold for this call.
    Confidence is high/med/low. Low is always queued as pending — never approved.
    """
    pol = get_policy(policy)
    thr = pol.thresholds_for(account)
    pct_threshold = thr.threshold_pct if threshold is None else float(threshold)

    with connect() as conn:
        as_of = period or get_meta(conn, "as_of_period")
        if prior_period is None:
            y, m = map(int, as_of.split("-"))
            m -= 1
            if m == 0:
                y -= 1
                m = 12
            prior_period = f"{y:04d}-{m:02d}"

    variance = get_account_variance(
        account, prior_period, as_of, entity=entity, policy=pol
    )
    if variance.get("error"):
        return variance

    from retrieval import retrieve_flux_evidence
    from llm import LLMError, get_provider
    from llm.drafting import SYSTEM_PROMPT, build_user_payload, DRAFT_JSON_SCHEMA
    from llm.heuristic import HeuristicProvider
    import logging
    import time

    log = logging.getLogger("finance_close.draft")

    evidence = retrieve_flux_evidence(account, entity, as_of, prior_period)
    txns = evidence.get("current") or []
    evidence_ids = set(evidence.get("evidence_txn_ids") or [])

    # Structural pass owns residual, confidence, citations, unsupported_je.
    structural = assess_flux(
        account,
        entity,
        as_of,
        prior_period,
        txns,
        variance,
        pol,
        pct_threshold,
        evidence=evidence,
    )
    user_payload = build_user_payload(
        account,
        entity,
        as_of,
        prior_period,
        variance,
        evidence,
        pct_threshold,
        structural=structural,
    )
    provider_name = get_llm_provider_name()
    draft_meta: dict[str, Any] = {
        "provider": provider_name or "config_default",
        "fallback": False,
        "citation_errors": [],
        "latency_ms": None,
        "usage": None,
    }

    def _heuristic_assess() -> dict[str, Any]:
        # Reuse the precomputed structural result (residual must not drift).
        return dict(structural)

    def _apply_llm_draft(raw: dict[str, Any], base: dict[str, Any]) -> dict[str, Any]:
        # Confidence / residual / explained stay code-owned.
        locked_conf = base.get("confidence")
        locked_explained = base.get("explained_amount")
        locked_residual = base.get("residual_amount")
        locked_status = base.get("status")
        locked_flags = list(base.get("flags") or [])
        structural_cites = list(base.get("citations") or [])

        cited = [str(x) for x in (raw.get("cited_ids") or [])]
        bad = [c for c in cited if c not in evidence_ids]
        draft_meta["citation_errors"] = bad
        if bad:
            log.warning("hallucinated citations %s → downgrade low", bad)
            locked_conf = "low"
            locked_flags = locked_flags + ["hallucinated_citation"]
            locked_status = (
                "queued_for_review"
                if pol.confidence.low_routes_to_human_review
                else locked_status
            )
            if locked_status == "approved":
                raise RuntimeError("agent must never auto-approve")

        commentary = str(raw.get("commentary") or "").strip()
        if not commentary:
            commentary = base.get("commentary") or ""

        # Union: structural required cites + any valid LLM cites
        valid_extra = [c for c in cited if c in evidence_ids]
        valid_cites = list(dict.fromkeys(structural_cites + valid_extra))
        if valid_cites and "Citations:" not in commentary:
            commentary = (
                commentary.rstrip(".")
                + ". Citations: "
                + ", ".join(valid_cites)
                + "."
            )
        if (
            locked_conf == "low"
            and pol.confidence.low_routes_to_human_review
            and "LOW CONFIDENCE" not in commentary
        ):
            commentary += " LOW CONFIDENCE — queued for human review (no auto-approve)."

        # LLM must not alter residual / explained / confidence.
        if raw.get("residual_amount") not in (None, locked_residual):
            log.warning(
                "LLM residual_amount %s ignored; keeping structural %s",
                raw.get("residual_amount"),
                locked_residual,
            )
        if raw.get("explained_amount") not in (None, locked_explained):
            log.warning(
                "LLM explained_amount %s ignored; keeping structural %s",
                raw.get("explained_amount"),
                locked_explained,
            )

        base["commentary"] = commentary
        base["citations"] = valid_cites
        base["confidence"] = locked_conf
        base["explained_amount"] = locked_explained
        base["residual_amount"] = locked_residual
        base["status"] = locked_status
        base["flags"] = locked_flags
        return base

    t0 = time.perf_counter()
    try:
        provider = get_provider(provider_name)
        draft_meta["provider"] = getattr(provider, "name", provider_name) or "unknown"
        raw = None
        last_err = None
        for attempt in range(2):
            try:
                raw = provider.generate(SYSTEM_PROMPT, user_payload, DRAFT_JSON_SCHEMA)
                break
            except LLMError as exc:
                last_err = exc
                log.warning("LLM JSON/provider error attempt %s: %s", attempt + 1, exc)
        if raw is None:
            log.warning("LLM failed after retry (%s); falling back to heuristic", last_err)
            draft_meta["fallback"] = True
            assessed = _heuristic_assess()
        elif draft_meta["provider"] == "heuristic" or isinstance(
            provider, HeuristicProvider
        ):
            assessed = raw.get("_heuristic_assessed") or _heuristic_assess()
            # Still lock residual/explained from structural precompute
            assessed["explained_amount"] = structural.get("explained_amount")
            assessed["residual_amount"] = structural.get("residual_amount")
            assessed["confidence"] = structural.get("confidence")
            assessed = _apply_llm_draft(raw, assessed)
        else:
            assessed = dict(structural)
            assessed = _apply_llm_draft(raw, assessed)
            if assessed.get("unsupported_je") or not assessed.get("citations"):
                assessed["confidence"] = "low"
                assessed["status"] = "queued_for_review"
            draft_meta["usage"] = raw.get("_usage")
    except Exception as exc:  # noqa: BLE001 — never fail close pass on provider
        log.warning("provider init/call failed (%s); heuristic fallback", exc)
        draft_meta["fallback"] = True
        draft_meta["provider"] = "heuristic"
        assessed = _heuristic_assess()
    draft_meta["latency_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    assessed["evidence_txn_ids"] = list(evidence_ids)
    assessed["draft_meta"] = draft_meta

    item_id = None
    should_queue = (
        assessed["status"] == "queued_for_review"
        or assessed["over_threshold"]
        or assessed["unsupported_je"]
    )
    with connect() as conn:
        if should_queue:
            item_id = f"RQ-{account}-{as_of}-{uuid.uuid4().hex[:6]}"
            conn.execute(
                """
                INSERT INTO review_queue(
                    item_id, account_id, period, entity, variance_pct, variance_amt,
                    draft_commentary, confidence, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item_id,
                    account,
                    as_of,
                    entity,
                    variance["variance_pct"],
                    variance["variance_amt"],
                    assessed["commentary"],
                    assessed["confidence"],
                    "pending",
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            conn.commit()
        payload = {
            "disclaimer": get_meta(conn, "disclaimer"),
            "account": account,
            "account_name": variance["account_name"],
            "entity": entity,
            "period": as_of,
            "prior_period": prior_period,
            "variance_pct": variance["variance_pct"],
            "variance_amt": variance["variance_amt"],
            "over_threshold": assessed["over_threshold"],
            "unsupported_je": assessed["unsupported_je"],
            "threshold": pct_threshold,
            "threshold_pct": pct_threshold,
            "threshold_amt": assessed["threshold_amt"],
            "confidence": assessed["confidence"],
            "evidence_score": assessed["evidence_score"],
            "flags": assessed["flags"],
            "citations": assessed["citations"],
            "commentary": assessed["commentary"],
            "explained_amount": assessed.get("explained_amount"),
            "residual_amount": assessed.get("residual_amount"),
            "evidence_txn_ids": assessed.get("evidence_txn_ids"),
            "draft_meta": assessed.get("draft_meta"),
            "review_item_id": item_id,
            "status": assessed["status"],
        }
        log_tool_call(
            conn,
            "draft_flux_commentary",
            {"account": account, "threshold": pct_threshold, "entity": entity},
            _summary(payload),
        )
        return payload


def list_review_queue(status: str | None = "pending") -> dict:
    with connect() as conn:
        if status:
            rows = conn.execute(
                "SELECT * FROM review_queue WHERE status = ? ORDER BY created_at DESC",
                (status,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM review_queue ORDER BY created_at DESC"
            ).fetchall()
        return {"items": rows_to_dicts(rows)}


def update_review_item(
    item_id: str,
    status: str,
    edited_commentary: str | None = None,
    reviewer_note: str | None = None,
) -> dict:
    """Human review action. Approving a low-confidence item requires a reviewer note."""
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM review_queue WHERE item_id = ?", (item_id,)
        ).fetchone()
        if not row:
            return {"error": "not_found", "item_id": item_id}
        current = dict(row)
        if status == "approved" and current.get("confidence") == "low":
            note = reviewer_note if reviewer_note is not None else current.get("reviewer_note")
            if not (note and str(note).strip()):
                return {
                    "error": "human_action_required",
                    "item_id": item_id,
                    "message": (
                        "Low-confidence items require an explicit reviewer_note "
                        "before approve."
                    ),
                }
        conn.execute(
            """
            UPDATE review_queue
            SET status = ?,
                edited_commentary = COALESCE(?, edited_commentary),
                reviewer_note = COALESCE(?, reviewer_note)
            WHERE item_id = ?
            """,
            (status, edited_commentary, reviewer_note, item_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM review_queue WHERE item_id = ?", (item_id,)
        ).fetchone()
        return dict(row) if row else {"error": "not_found", "item_id": item_id}


def get_tool_call_log(limit: int = 50) -> dict:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM tool_call_log ORDER BY log_id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return {"calls": rows_to_dicts(rows)}
