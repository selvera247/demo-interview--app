#!/usr/bin/env python3
"""Verify MCP tool spine is importable and each tool returns synthetic data.

Does not require Claude Desktop. Exit 0 on success.
Claude Desktop still needs a local stdio config pointing at mcp_server.py.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main() -> int:
    import mcp_server  # noqa: F401
    import tools as t

    checks: list[tuple[str, bool, str]] = []

    tb = t.get_trial_balance("2026-09", "ND-US")
    ok = isinstance(tb, dict) and "accounts" in tb and len(tb["accounts"]) > 0
    checks.append(("get_trial_balance", ok, f"accounts={len(tb.get('accounts') or [])}"))

    var = t.get_account_variance("6110", "2026-05", "2026-06", entity="ND-US")
    ok = isinstance(var, dict) and "variance_amt" in var
    checks.append(("get_account_variance", ok, f"amt={var.get('variance_amt')}"))

    detail = t.get_subledger_detail("6110", "2026-06", entity="ND-US")
    ok = isinstance(detail, dict) and "transactions" in detail
    checks.append(
        ("get_subledger_detail", ok, f"txns={len(detail.get('transactions') or [])}")
    )

    tasks = t.list_open_close_tasks(period="2026-09", entity="ND-US")
    ok = isinstance(tasks, dict) and "open_count" in tasks
    checks.append(("list_open_close_tasks", ok, f"open={tasks.get('open_count')}"))

    draft = t.draft_flux_commentary(
        "6110", entity="ND-US", period="2026-06", prior_period="2026-05"
    )
    ok = isinstance(draft, dict) and bool(draft.get("commentary"))
    checks.append(
        ("draft_flux_commentary", ok, f"confidence={draft.get('confidence')}")
    )

    failed = [name for name, passed, _ in checks if not passed]
    for name, passed, detail in checks:
        mark = "OK" if passed else "FAIL"
        print(f"{mark}  {name}  ({detail})")

    if failed:
        print(f"FAILED: {failed}", file=sys.stderr)
        return 1

    print("MCP tool spine verified (Claude Desktop: point stdio at mcp_server.py).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
