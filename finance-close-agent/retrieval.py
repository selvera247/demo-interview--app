"""Generic flux evidence retrieval — no planted IDs or seed-specific strings."""

from __future__ import annotations

import re
from typing import Any

from db import connect, rows_to_dicts

_ACCOUNT_ID_RE = re.compile(r"\b([0-9]{4})\b")


def _fetch_subledger(account: str, entity: str, period: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT s.txn_id, s.txn_date, s.party_id, p.name AS party_name,
                   s.memo, s.amount, s.source_system, s.entry_type,
                   s.account_id, s.entity, s.period
            FROM subledger s
            LEFT JOIN parties p ON p.party_id = s.party_id
            WHERE s.account_id = ? AND s.period = ? AND s.entity = ?
            ORDER BY ABS(s.amount) DESC, s.txn_date, s.txn_id
            """,
            (account, period, entity),
        ).fetchall()
        return rows_to_dicts(rows)


def _counterpart_accounts_from_structure(
    account: str,
    entity: str,
    period: str,
    current: list[dict[str, Any]],
) -> list[str]:
    """Find other accounts in the same entity/period that look like paired JEs.

    Uses opposite-signed amounts (within $1) and optional 4-digit account refs in
    memos. Does not hardcode planted memos, vendors, or txn-id prefixes.
    """
    found: set[str] = set()
    with connect() as conn:
        for txn in current:
            amt = float(txn.get("amount") or 0)
            if abs(amt) < 0.005:
                continue
            # Opposite-signed counterpart elsewhere in the entity/period
            rows = conn.execute(
                """
                SELECT DISTINCT account_id FROM subledger
                WHERE entity = ? AND period = ? AND account_id != ?
                  AND ABS(amount + ?) < 1.0
                """,
                (entity, period, account, amt),
            ).fetchall()
            for r in rows:
                found.add(r["account_id"])
            memo = txn.get("memo") or ""
            for m in _ACCOUNT_ID_RE.findall(memo):
                if m != account:
                    # Only keep if that account actually has activity this period
                    hit = conn.execute(
                        """
                        SELECT 1 FROM subledger
                        WHERE entity = ? AND period = ? AND account_id = ?
                        LIMIT 1
                        """,
                        (entity, period, m),
                    ).fetchone()
                    if hit:
                        found.add(m)
    return sorted(found)


def retrieve_flux_evidence(
    account: str,
    entity: str,
    period: str,
    prior_period: str,
) -> dict[str, Any]:
    """Fetch all evidence for a flagged flux item.

    Returns:
      - current: all subledger rows for account/entity/period
      - prior: all subledger rows for account/entity/prior_period
      - counterparts: map account_id -> rows for structurally paired accounts
      - evidence_txn_ids: flat set of every retrieved txn_id
    """
    current = _fetch_subledger(account, entity, period)
    prior = _fetch_subledger(account, entity, prior_period)
    counterpart_ids = _counterpart_accounts_from_structure(
        account, entity, period, current
    )
    counterparts: dict[str, list[dict[str, Any]]] = {}
    for other in counterpart_ids:
        counterparts[other] = _fetch_subledger(other, entity, period)

    evidence_txn_ids: list[str] = []
    for block in (current, prior):
        for t in block:
            evidence_txn_ids.append(t["txn_id"])
    for rows in counterparts.values():
        for t in rows:
            evidence_txn_ids.append(t["txn_id"])

    # Preserve order, unique
    evidence_txn_ids = list(dict.fromkeys(evidence_txn_ids))

    return {
        "account": account,
        "entity": entity,
        "period": period,
        "prior_period": prior_period,
        "current": current,
        "prior": prior,
        "counterparts": counterparts,
        "counterpart_accounts": counterpart_ids,
        "evidence_txn_ids": evidence_txn_ids,
    }
