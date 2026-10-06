# Finance MCP Server + Close Agent

Synthetic close demo for fictional company **Northwind Digital**: MCP tools over a miniature finance system, a close agent that flags variances and drafts flux commentary, a human review queue, and (later) a scored eval set.

**All data is synthetic.** Nothing here is real company financials.

## What’s included

| Piece | Path |
| --- | --- |
| Synthetic data generator (24 months TB, AR + AP/accrual detail) | `generate_data.py` |
| Policy (thresholds, confidence cutoffs) | `config/policy.yaml`, `policy.py` |
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
- Planted anomalies A1–A4, B1–B2, and C1 (med partial Software) — see `data/ANOMALIES.md`
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

### Demo checklist (slice 5)

1. **Regenerate / verify data** (if needed):
   ```bash
   python3 generate_data.py
   python3 verify_data.py   # expects 9 breaches including C1
   ```
2. **Run close pass** (all entities, default policy):
   ```bash
   python3 agent/close_agent.py
   ```
   Expect **9** flagged accounts; **2** routed as `queued_for_review` (C1 med + A4 low). All 9 land as **pending** in the review queue.
3. **Open Streamlit**:
   ```bash
   streamlit run ui/review_app.py
   ```
   Click **Run close pass (all entities)** if the queue is empty.
4. **Expected pending items: 9**, sorted **low → med → high**, then largest |$| variance.
5. **What each confidence should look like:**
   - **low** — A4 T&E (`6310` ND-US 2026-09): unsupported blank JE, policy rule `threshold+unsupported_je`, no reliable citations; approve without a reviewer note is **blocked**.
   - **med** — C1 Software (`6100` ND-EU 2026-08): cites `SW-LICENSE-2026-EU` ($60k) and states ~$30k unexplained residual; queued for review.
   - **high** — A1/A2/A3/B1/B2 (and pairs): full subledger citations, policy rule `threshold`, draft-ready commentary.
6. **Text-only queue check** (no screenshot):
   ```bash
   python3 ui/verify_queue_text.py
   ```

```bash
python3 agent/close_agent.py
streamlit run ui/review_app.py
```

> Pass `ND-US` / `ND-EU` explicitly when calling tools with a single entity.

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

- Low- and med-confidence drafts are marked for **human review** instead of guessing
- Every tool call is appended to `tool_call_log` (UI log tab shows timestamp, tool, inputs, served item)
- Review queue supports **approve / edit / reject** with a **required reviewer note**
- Queue sorts low confidence first, then dollar size; each card shows citations + policy rule
- Eval score is published only after hand-written cases exist
