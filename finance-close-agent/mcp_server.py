#!/usr/bin/env python3
"""Finance MCP Server — Close Agent tools for Claude Desktop / MCP clients.

Tools:
  - get_trial_balance(period, entity)
  - get_account_variance(account, period_a, period_b)
  - get_subledger_detail(account, period)
  - list_open_close_tasks()
  - draft_flux_commentary(account, threshold)

Claude Desktop config example (stdio):

{
  "mcpServers": {
    "finance-close": {
      "command": "python",
      "args": ["/absolute/path/to/finance-close-agent/mcp_server.py"],
      "cwd": "/absolute/path/to/finance-close-agent"
    }
  }
}
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import tools as t  # noqa: E402


def _make_server():
    """Support mcp 1.x FastMCP and mcp 2.x MCPServer."""
    try:
        from mcp.server.mcpserver import MCPServer as Server
    except ImportError:  # pragma: no cover
        try:
            from mcp.server.fastmcp import FastMCP as Server
        except ImportError as exc:
            raise SystemExit(
                "Missing dependency: pip install -r requirements.txt\n"
                f"Original error: {exc}"
            ) from exc

    return Server(
        "finance-close",
        instructions=(
            "Synthetic finance close system. All balances and transactions are "
            "demo data. Prefer citing txn_ids. When confidence is low, say so "
            "and use draft_flux_commentary so items land in the human review queue."
        ),
    )


def main() -> None:
    mcp = _make_server()

    @mcp.tool()
    def get_trial_balance(period: str, entity: str = "US-01") -> dict:
        """Return GL trial balance for a period and entity (synthetic data)."""
        return t.get_trial_balance(period, entity)

    @mcp.tool()
    def get_account_variance(
        account: str,
        period_a: str,
        period_b: str,
        entity: str = "US-01",
    ) -> dict:
        """Compare an account ending balance between two periods."""
        return t.get_account_variance(account, period_a, period_b, entity=entity)

    @mcp.tool()
    def get_subledger_detail(
        account: str,
        period: str,
        entity: str = "US-01",
    ) -> dict:
        """Pull sub-ledger transactions for an account/period."""
        return t.get_subledger_detail(account, period, entity=entity)

    @mcp.tool()
    def list_open_close_tasks(
        period: str | None = None,
        entity: str | None = None,
    ) -> dict:
        """List close checklist tasks (optionally filter by period/entity)."""
        return t.list_open_close_tasks(period=period, entity=entity)

    @mcp.tool()
    def draft_flux_commentary(
        account: str,
        threshold: float | None = None,
        entity: str = "US-01",
    ) -> dict:
        """Draft flux commentary from subledger drivers; queue low-confidence items.

        threshold: optional percent override; when omitted, uses config/policy.yaml.
        """
        return t.draft_flux_commentary(account, threshold=threshold, entity=entity)

    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
