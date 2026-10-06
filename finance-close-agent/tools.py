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
                   s.memo, s.amount, s.source_system
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
    Dollar threshold always comes from policy (including per-account overrides).
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

    detail = get_subledger_detail(account, as_of, entity=entity)
    txns = detail.get("transactions", [])

    # Heuristic confidence / commentary (high/med/low mapping is slice 4)
    confidence = 0.55
    flags: list[str] = []
    citations: list[str] = []
    driver_lines: list[str] = []

    memos = " ".join(t.get("memo", "").lower() for t in txns)
    txn_ids = [t["txn_id"] for t in txns]

    if any("duplicate" in t.get("memo", "").lower() for t in txns) or any(
        "ACCR-CLOUD-6110" in tid for tid in txn_ids
    ):
        confidence = 0.92
        flags.append("possible_duplicate_je")
        dups = [
            t
            for t in txns
            if "duplicate" in t["memo"].lower() or "ACCR-CLOUD-6110" in t["txn_id"]
        ]
        for t in dups:
            citations.extend([t["txn_id"], t.get("party_id") or ""])
            driver_lines.append(
                f"{t['txn_id']} ({t.get('party_name') or t.get('party_id')}: {t['amount']:,.0f}) looks like a duplicate accrual."
            )

    if "reclass" in memos:
        confidence = max(confidence, 0.88)
        flags.append("reclass")
        for t in txns:
            if "reclass" in t["memo"].lower():
                citations.append(t["txn_id"])
                driver_lines.append(
                    f"Reclass activity {t['txn_id']}: {t['memo']} ({t['amount']:,.0f})."
                )

    if "deferred" in memos or "renewal" in memos or "timing" in memos or "ctr-4000" in memos:
        confidence = max(confidence, 0.86)
        flags.append("revenue_timing")
        for t in txns:
            low = t["memo"].lower()
            if any(k in low for k in ("deferred", "renewal", "timing", "ctr-4000")):
                citations.extend([t["txn_id"], t.get("party_id") or ""])
                driver_lines.append(
                    f"Revenue timing {t['txn_id']}: {t['memo']} ({t['amount']:,.0f})."
                )

    if not driver_lines:
        confidence = 0.35
        flags.append("needs_human_review")
        if abs(variance["variance_amt"]) > thr.threshold_amt:
            driver_lines.append(
                "No clear subledger driver above noise; marking for human review rather than guessing."
            )
        else:
            driver_lines.append("Variance within operational noise; no material commentary required.")

    over = abs(variance["variance_pct"]) > pct_threshold and abs(
        variance["variance_amt"]
    ) > thr.threshold_amt
    commentary = (
        f"{variance['account_name']} ({account}) moved {variance['variance_pct']:.1%} "
        f"({variance['variance_amt']:+,.0f}) from {prior_period} to {as_of}. "
        + " ".join(driver_lines)
    )
    if over and confidence < pol.confidence.med_min and pol.confidence.low_routes_to_human_review:
        commentary += " LOW CONFIDENCE — route to review queue before close sign-off."

    needs_review = (
        confidence < pol.confidence.med_min and pol.confidence.low_routes_to_human_review
    ) or "possible_duplicate_je" in flags
    item_id = None
    with connect() as conn:
        if needs_review or over:
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
                    commentary,
                    confidence,
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
            "over_threshold": over,
            "threshold": pct_threshold,
            "threshold_pct": pct_threshold,
            "threshold_amt": thr.threshold_amt,
            "confidence": confidence,
            "flags": flags,
            "citations": [c for c in citations if c],
            "commentary": commentary,
            "review_item_id": item_id,
            "status": "queued_for_review" if needs_review else "draft_ready",
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
    with connect() as conn:
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
