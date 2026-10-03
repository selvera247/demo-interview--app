"""SQLite helpers for the Finance Close MCP server."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "finance.db"


def connect(db_path: Path | None = None) -> sqlite3.Connection:
    path = db_path or DB_PATH
    if not path.exists():
        raise FileNotFoundError(
            f"Database not found at {path}. Run: python generate_data.py"
        )
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict]:
    return [dict(r) for r in rows]


def log_tool_call(
    conn: sqlite3.Connection,
    tool_name: str,
    arguments: dict,
    result_summary: str,
) -> None:
    conn.execute(
        "INSERT INTO tool_call_log(ts, tool_name, arguments, result_summary) VALUES (?, ?, ?, ?)",
        (
            datetime.now(timezone.utc).isoformat(),
            tool_name,
            json.dumps(arguments),
            result_summary[:500],
        ),
    )
    conn.commit()


def get_meta(conn: sqlite3.Connection, key: str, default: str = "") -> str:
    row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default
