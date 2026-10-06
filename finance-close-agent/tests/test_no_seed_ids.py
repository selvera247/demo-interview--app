"""Fail if agent/tools embed seed-specific planted identifiers."""

from __future__ import annotations

import re
import sqlite3
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DB_PATH = ROOT / "data" / "finance.db"
SCAN_DIRS = [ROOT / "agent", ROOT / "tools.py", ROOT / "retrieval.py"]


def _planted_tokens_from_db() -> set[str]:
    """Derive forbidden tokens from the demo DB (seed 42 identifiers)."""
    tokens: set[str] = set()
    # Always-forbid well-known demo prefixes even if DB missing
    tokens.update(
        {
            "ACCR-CLOUD-6110",
            "SW-LICENSE",
            "SW-RESIDUAL",
            "CONF-2026-ANNUAL",
            "HIRING-SURGE",
            "JE-REV-TIMING",
            "JE-MANUAL-BLANK",
            "CTR-4000-NDUS",
            "ACCR-TRAVEL-NEAR",
            "INS-ANNUAL-2026",
            "JE-MOVE-6010",
            "JE-MOVE-6900",
        }
    )
    if not DB_PATH.exists():
        return tokens
    conn = sqlite3.connect(DB_PATH)
    try:
        for (cid,) in conn.execute(
            "SELECT expected_citations FROM anomalies"
        ).fetchall():
            if not cid:
                continue
            # JSON list or raw
            for m in re.findall(r"[A-Z0-9][A-Z0-9_-]{5,}", cid):
                if any(ch.isdigit() for ch in m):
                    tokens.add(m)
        for (txn_id,) in conn.execute(
            """
            SELECT DISTINCT txn_id FROM subledger
            WHERE txn_id LIKE 'ACCR-CLOUD%'
               OR txn_id LIKE 'SW-%'
               OR txn_id LIKE 'CONF-2026%'
               OR txn_id LIKE 'HIRING-SURGE%'
               OR txn_id LIKE 'JE-REV-TIMING%'
               OR txn_id LIKE 'JE-MANUAL-BLANK%'
               OR txn_id LIKE 'JE-RCL-%'
            """
        ).fetchall():
            # Use stable prefix before trailing period suffix
            base = re.sub(r"-20\d{2}-\d{2}$", "", txn_id)
            tokens.add(base)
            tokens.add(txn_id)
    finally:
        conn.close()
    return tokens


def _iter_source_files():
    for path in SCAN_DIRS:
        if path.is_file():
            yield path
        elif path.is_dir():
            yield from path.rglob("*.py")


def test_agent_and_tools_have_no_seed_specific_identifiers():
    tokens = sorted(t for t in _planted_tokens_from_db() if len(t) >= 6)
    assert tokens, "expected planted tokens from DB or builtins"
    hits: list[str] = []
    for path in _iter_source_files():
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(ROOT)
        for tok in tokens:
            if tok in text:
                hits.append(f"{rel}: {tok}")
    assert not hits, (
        "Seed-specific planted identifiers found in agent/tools code:\n"
        + "\n".join(hits[:40])
    )
