# Spec: Finance MCP Server + Close Agent

## Purpose
Agent answers close questions and drafts flux commentary over synthetic ERP data, with human review and measurable accuracy.

## Orchestration (merged product spine)
- **Core spine (required):** SQLite + MCP tools + `config/policy.yaml` + Streamlit review + evals.
- **Optional API/workflow layer:** FastAPI exposes the same close pass; LangGraph stages
  (`extract → flag → draft → approval_gate → summary`) call existing agent/tools — they must
  not invent a second variance engine or sample GL.
- Real vendor product names remain forbidden (`ERP` / `Billing` / `HRIS` / `Expense Tool` only).

## Synthetic data (company: Northwind Digital)
- GL trial balance: 24 months, ~40 accounts, 2 entities (`ND-US`, `ND-EU`)
- Storage: **SQLite** (not DuckDB — see DECISIONS.md)
- AR sub-ledger: invoices, payments, customers
- AP/accrual detail for expense accounts
- `source_system` labels must be generic only (`ERP`, `Billing`, `HRIS`). No real vendor product names anywhere.
- Planted anomalies (must be documented in `data/ANOMALIES.md`):
  1. Duplicate accrual in a prior month
  2. Reclass between two opex accounts
  3. Revenue timing swing across a quarter boundary
  4. One unexplained variance (agent should flag low confidence)

## MCP tools
- `get_trial_balance(period, entity)`
- `get_account_variance(account, period_a, period_b)`
- `get_subledger_detail(account, period)`
- `list_open_close_tasks()`
- `draft_flux_commentary(account, threshold)`

## Agent behavior
- Flag accounts exceeding thresholds in `config/policy.yaml` (default: >10% AND >$50K)
- Pull sub-ledger drivers, draft commentary citing specific transactions
- Assign confidence as **high / med / low** using cutoffs defined in `config/policy.yaml`
- Low confidence goes to human review, never guessed

## Review UI (Streamlit)
- Queue of drafted commentary: approve / edit / reject
- Log of every tool call with timestamp and inputs

## Evals
- `evals/cases.yaml`: 15–20 variances with known correct explanations (**authored by the project owner, not generated**)
- Scaffold may include account, period, and amounts with blank `explanation` fields until filled in
- Harness scores accuracy and reports it in the README
- Do **not** publish an eval score in README or UI until hand-written cases exist (avoid circular scoring against generator-planted keys)

## Definition of done
- Runs end to end from a fresh clone via documented commands
- Tests pass, eval score published (only after hand-written cases), README with architecture diagram
- Works in Claude Desktop via MCP
- FastAPI + LangGraph close workflow returns the same flagged set as `agent/close_agent.py`

## Out of scope until DoD (slice 7 complete)
- Portfolio landing page (except unpublishing premature eval scores when SPEC requires it)
- Deal Record demo
- Removing or changing `react-router-dom` / frontend routing (frozen)
- Sync/publish mirror to external `cjs-ops/agentic-finance-ops-demo` (deferred; no write access from this environment)
