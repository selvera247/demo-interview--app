# Finance MCP Server + Close Agent

Synthetic close demo: an MCP server over a miniature finance system, a heuristic close agent that flags variances and drafts flux commentary, a human review queue, and a scored eval set.

**All data is synthetic.** Nothing here is real company financials.

## What’s included

| Piece | Path |
| --- | --- |
| Synthetic data generator (24 months TB, AR/subledger, planted anomalies) | `generate_data.py` |
| SQLite database | `data/finance.db` |
| MCP tools | `tools.py`, `mcp_server.py` |
| Close agent pass | `agent/close_agent.py` |
| Review UI (approve / edit / reject + tool audit log) | `ui/review_app.py` |
| Eval set (19 variances with gold explanations) | `evals/variance_eval_set.json` |
| Eval runner | `evals/run_evals.py` |
| Static export for the portfolio demo | `exports/demo_bundle.json` |

### MCP tools

- `get_trial_balance(period, entity)`
- `get_account_variance(account, period_a, period_b)`
- `get_subledger_detail(account, period)`
- `list_open_close_tasks()`
- `draft_flux_commentary(account, threshold)`

### Planted anomalies (US-01, latest period)

1. **Duplicate accrual** on Accrued Expenses (`JE-ACC-4401` + `JE-ACC-4401-DUP`)
2. **Reclass** Prepaid → Other Current Assets (`JE-RCL-8810`)
3. **Revenue timing** pull-forward from Deferred Revenue (`JE-REV-2207`)

## Setup

```bash
cd finance-close-agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python generate_data.py
```

## Run the agent + review UI

```bash
python agent/close_agent.py
streamlit run ui/review_app.py
```

## Run evals

```bash
python evals/run_evals.py
```

Latest local score is written to `exports/eval_report.json` and surfaced on the portfolio case study page.

## Claude Desktop (MCP)

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "finance-close": {
      "command": "python",
      "args": ["/absolute/path/to/finance-close-agent/mcp_server.py"],
      "cwd": "/absolute/path/to/finance-close-agent"
    }
  }
}
```

Then ask things like:

> For US-01, which accounts broke 10% and $50K MoM? Draft flux commentary and cite the JE ids. Queue anything you’re not sure about.

## Guardrails

- Low-confidence drafts are marked for **human review** instead of guessing
- Every tool call is appended to `tool_call_log`
- Review queue supports **approve / edit / reject**
- Eval set scores citation + driver match against known explanations
