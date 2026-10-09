# Finance MCP Server + Close Agent

Synthetic close demo for fictional company **Northwind Digital**: MCP tools over a miniature finance system, a close agent that flags variances and drafts flux commentary, a human review queue, FastAPI + LangGraph orchestration, and an eval harness (score unpublished until answer keys are complete).

**All data is synthetic.** Nothing here is real company financials.

## Architecture

```text
Claude Desktop (MCP)  ──┐
FastAPI / LangGraph   ──┼──► tools.py / policy.yaml / SQLite
Streamlit review UI   ──┘         │
                                  ▼
                         review_queue + tool_call_log
                                  │
                         evals/cases.yaml (score when keys filled)
```

LangGraph stages: `extract → flag_and_draft → approval_gate → summary`  
(`flag_and_draft` calls the same `run_close_pass` as the CLI agent — no second variance engine.)

## What’s included

| Piece | Path |
| --- | --- |
| Synthetic data generator (24 months TB, AR + AP/accrual detail) | `generate_data.py` |
| Policy (thresholds, confidence cutoffs) | `config/policy.yaml`, `policy.py` |
| Data verification script | `verify_data.py` |
| SQLite database | `data/finance.db` |
| MCP tools | `tools.py`, `mcp_server.py` |
| Close agent pass | `agent/close_agent.py` |
| LangGraph close workflow | `workflows/close_workflow.py` |
| FastAPI surface | `api/main.py` |
| Review UI (approve / edit / reject + tool audit log) | `ui/review_app.py` |
| Eval harness (`cases.yaml` stubs + deterministic scorer) | `evals/` |
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

## Run FastAPI + LangGraph workflow

```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

- Docs: http://127.0.0.1:8000/docs
- Ready: `GET /health/ready`
- Close pass: `POST /finance/close-pass` with optional `{"entity":"ND-US"}`
- Audit trail: `GET /finance/audit-trail`
- Review queue: `GET /finance/review-queue`

```bash
python3 -m pytest tests/test_workflow_api.py -q
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

`evals/cases.yaml` has stubs (must_cite pre-filled). Fill `expected_explanation`,
`required_facts`, `must_not_say`, and `expected_confidence` before treating any
score as valid. Incomplete answer keys exit non-zero and pytest fails until filled.

```bash
python3 evals/run_evals.py
python3 -m pytest tests/test_evals.py -q
```

Do not publish a score in this README until the answer key is complete.

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

### Known limitations

- **Paired anomalies** (A2/A2B, A3/A3B) appear as separate review-queue rows; grouping is optional polish.
- **Agent does not recommend remediation** (e.g., reversing a duplicate accrual). It identifies the driver and cites evidence, but does not prescribe the correcting JE. Tracked as a product gap, not hidden in the eval answer key.
