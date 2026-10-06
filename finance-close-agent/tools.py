"""Finance MCP tool implementations (shared by MCP server and local agent)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from db import connect, get_meta, log_tool_call, rows_to_dicts
from policy import Policy, load_policy

_POLICY: Policy | None = None


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
    """Score evidence generically (no planted IDs / seed-specific strings).

    Structural signals only:
      - unsupported JE policy
      - identical or near-identical amount pairs (same party)
      - magnitude coverage of the variance by retrieved rows
      - counterpart activity when present
    """
    thr = policy.thresholds_for(account)
    flags: list[str] = []
    citations: list[str] = []
    driver_lines: list[str] = []
    evidence_score = 0.0

    current = list(txns)
    if evidence is not None:
        current = list(evidence.get("current") or txns)

    unsupported_txns = [t for t in current if policy.is_unsupported_txn(t)]
    if unsupported_txns:
        flags.append("unsupported_je")
        for t in unsupported_txns:
            citations.append(t["txn_id"])
            driver_lines.append(
                f"{t['txn_id']} is unsupported (blank description and/or no vendor); "
                "do not invent a driver."
            )
        evidence_score = 0.0

    # Identical-amount pairs (same party) → possible duplicate accruals
    by_key: dict[tuple[Any, float], list[dict]] = {}
    for t in current:
        party = t.get("party_id") or ""
        amt = round(float(t.get("amount") or 0), 2)
        by_key.setdefault((party, amt), []).append(t)
    for (party, amt), group in by_key.items():
        if party and abs(amt) >= 1000 and len(group) >= 2:
            flags.append("possible_duplicate_je")
            evidence_score = max(evidence_score, 0.92)
            for t in group:
                citations.append(t["txn_id"])
                driver_lines.append(
                    f"{t['txn_id']} ({t.get('party_name') or party}: {amt:,.0f}) "
                    f"matches another posting for the same party/amount."
                )
            driver_lines.append(
                "Identical same-party postings may indicate a duplicate accrual; "
                f"they cover {abs(amt) * len(group):,.0f} of activity."
            )
            break

    # Near-identical amounts (diff <= $500), same party
    if "possible_duplicate_je" not in flags:
        keyed: list[tuple[str, float, dict]] = []
        for t in current:
            party = t.get("party_id") or ""
            if not party:
                continue
            keyed.append((party, float(t.get("amount") or 0), t))
        for i, (p1, a1, t1) in enumerate(keyed):
            for p2, a2, t2 in keyed[i + 1 :]:
                if p1 == p2 and 0 < abs(abs(a1) - abs(a2)) <= 500:
                    flags.append("near_duplicate_je")
                    evidence_score = max(evidence_score, 0.65)
                    citations.extend([t1["txn_id"], t2["txn_id"]])
                    driver_lines.append(
                        f"Near-duplicate same-party amounts "
                        f"({a1:,.0f} vs {a2:,.0f}) on {t1['txn_id']} / {t2['txn_id']}."
                    )
                    break
            if "near_duplicate_je" in flags:
                break

    # Counterpart structural pairs (opposite-signed activity on another account)
    counterparts = (evidence or {}).get("counterparts") or {}
    if counterparts and "possible_duplicate_je" not in flags:
        flags.append("paired_offset_activity")
        evidence_score = max(evidence_score, 0.88)
        for other_acct, rows in counterparts.items():
            for t in rows[:3]:
                citations.append(t["txn_id"])
                driver_lines.append(
                    f"Paired activity on {other_acct}: {t['txn_id']} "
                    f"({t.get('memo') or 'no memo'}: {t['amount']:,.0f})."
                )

    # Magnitude coverage: largest absolute current-period rows vs variance
    var_amt = abs(float(variance.get("variance_amt") or 0))
    if current and var_amt > 0 and not unsupported_txns:
        ranked = sorted(
            current, key=lambda t: abs(float(t.get("amount") or 0)), reverse=True
        )
        covered = 0.0
        explaining: list[dict] = []
        for t in ranked:
            covered += abs(float(t.get("amount") or 0))
            explaining.append(t)
            citations.append(t["txn_id"])
            if covered >= var_amt * 0.95:
                break
        if explaining and "possible_duplicate_je" not in flags:
            for t in explaining[:5]:
                driver_lines.append(
                    f"{t['txn_id']}: {t.get('memo') or '(blank memo)'} "
                    f"({float(t['amount']):,.0f})."
                )
            residual = max(0.0, var_amt - covered)
            if residual <= max(500.0, var_amt * 0.05):
                evidence_score = max(evidence_score, 0.90)
                flags.append("subledger_covers_variance")
            elif covered >= var_amt * 0.55:
                evidence_score = max(evidence_score, 0.65)
                flags.append("partial_subledger_coverage")
                driver_lines.append(
                    f"Partial explanation: ${covered:,.0f} supported; "
                    f"${residual:,.0f} unexplained residual."
                )
            else:
                evidence_score = max(evidence_score, 0.35)
                flags.append("weak_subledger_coverage")
                driver_lines.append(
                    f"Retrieved activity covers ${covered:,.0f} of "
                    f"${var_amt:,.0f} variance; ${residual:,.0f} unexplained."
                )

    citations = list(dict.fromkeys(c for c in citations if c))

    if unsupported_txns:
        evidence_score = 0.0

    if not citations:
        evidence_score = 0.0
        flags.append("no_citations")
        if not driver_lines:
            driver_lines.append(
                "No citable subledger transactions; confidence capped at low."
            )

    if not driver_lines and not unsupported_txns:
        flags.append("needs_human_review")
        evidence_score = 0.0
        driver_lines.append(
            "No clear subledger driver; marking for human review rather than guessing."
        )

    confidence = policy.confidence.label_for_score(evidence_score)
    if unsupported_txns or not citations:
        confidence = "low"

    over = abs(variance["variance_pct"]) > pct_threshold and abs(
        variance["variance_amt"]
    ) > thr.threshold_amt
    unsupported_flag = bool(unsupported_txns)

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
        "explained_amount": None,
        "residual_amount": None,
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

    evidence = retrieve_flux_evidence(account, entity, as_of, prior_period)
    txns = evidence.get("current") or []
    assessed = assess_flux(
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
    assessed["evidence_txn_ids"] = list(evidence.get("evidence_txn_ids") or [])

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
