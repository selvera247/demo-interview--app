# Finance MCP Server + Close Agent

Synthetic close demo for fictional company **Northwind Digital**: MCP tools over a miniature finance system, a close agent that flags variances and drafts flux commentary, a human review queue, and (later) a scored eval set.

**All data is synthetic.** Nothing here is real company financials.

## What’s included

| Piece | Path |
| --- | --- |
| Synthetic data generator (24 months TB, AR + AP/accrual detail) | `generate_data.py` |
| Data verification script | `verify_data.py` |
| SQLite database | `data/finance.db` |
| MCP tools | `tools.py`, `mcp_server.py` |
| Close agent pass | `agent/close_agent.py` |
| Review UI (approve / edit / reject + tool audit log) | `ui/review_app.py` |
| Eval harness (hand-written cases TBD) | `evals/` |
| Static export | `exports/demo_bundle.json` |

### MCP tools

- `get_trial_balance(period, entity)`
- `get_account_variance(account, period_a, period_b)`
- `get_subledger_detail(account, period)`
- `list_open_close_tasks()`
- `draft_flux_commentary(account, threshold)`

### Data model (slice 1–2)

- Company: Northwind Digital
- Entities: `ND-US`, `ND-EU`
- ~40 accounts, 24 months trial balance
- Planted anomalies A1–A4 and benign breaches B1–B2 — see `data/ANOMALIES.md`
- `source_system` labels: `ERP`, `Billing`, `HRIS`, `Expense Tool` only

## Setup

```bash
cd finance-close-agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python generate_data.py
python verify_data.py
```

## Run the agent + review UI

```bash
python agent/close_agent.py --entity ND-US
streamlit run ui/review_app.py
```

> Note: agent/MCP defaults may still say a legacy entity id until a later slice; pass `ND-US` explicitly.

## Run evals

Hand-written `evals/cases.yaml` is not in place yet. Do not treat any prior score as valid.

```bash
python evals/run_evals.py
```

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

Example prompt:

> For ND-US, which accounts broke 10% and $50K MoM? Draft flux commentary and cite transaction ids. Queue anything you’re not sure about.

## Guardrails

- Low-confidence drafts are marked for **human review** instead of guessing
- Every tool call is appended to `tool_call_log`
- Review queue supports **approve / edit / reject**
- Eval score is published only after hand-written cases exist
