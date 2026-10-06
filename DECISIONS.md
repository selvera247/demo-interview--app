# Decisions

## 2026-10-03 — Use SQLite instead of DuckDB

- **Decision:** Keep SQLite as the demo datastore; do not add DuckDB.
- **Why:** The working scaffold already uses SQLite; migrating adds a dependency and rewrite cost without changing the hiring-manager demo narrative. SPEC amended accordingly (~40 accounts, SQLite).
- **Implications:** README, generator, MCP tools, and tests target SQLite. No `duckdb` in `requirements.txt`.

## 2026-10-03 — Slice 1 clean baseline data model

- **Decision:** Regenerate `finance.db` as a clean Northwind Digital baseline (entities `ND-US` / `ND-EU`, ~40 accounts, 24 months) with AR + AP/accrual/opex subledgers that reconcile to the TB. Remove prior planted anomalies from the generator; defer anomaly planting to slice 2.
- **Why:** SPEC requires a realistic CoA and reconciling subledgers under generic `source_system` labels. Prior data mixed legacy entities, real vendor system names, and generator-planted anomalies that made eval scoring circular.
- **Implications:**
  - Customer formerly named like the company was renamed to **Cedar Analytics**.
  - `source_system` values are only `ERP`, `Billing`, `HRIS`, `Expense Tool`.
  - MoM growth/seasonality tuned so dual-threshold breaches are rare on clean data.
  - Stale generated eval JSON cleared to `[]` / null score until hand-written `cases.yaml` exists.
  - Agent/MCP/UI defaults left untouched this slice (may still reference legacy entity ids until a later slice).

## 2026-10-06 — Slice 2 anomaly planting

- **Decision:** Plant A1–A4 and benign B1–B2 in the generator with sticky vs one-period mutations so the MoM breach set is exactly eight keys (A1, A2, A2B, A3, A3B, A4, B1, B2). Extend `anomalies` table with `entity`, `amount`, `expected_confidence`. Map T&E → `6310 Meals & Entertainment`. Store paired/offset sides as `A2B` / `A3B`. For A3, only mutate the quarter-end TB; the following month keeps the clean TB but includes an explicit reversing JE (avoids a third revenue breach in August).
- **Why:** Need deterministic, documented exceptions for the close-agent demo without polluting clean months with extra threshold breaches. Sticky A1/A2/B2 avoids reverse-side MoM breaches; latest-period A4/B1 and A3’s clean-TB offset month keep the breach list exact.
- **Implications:** `data/ANOMALIES.md` is source docs; `verify_anomalies.py` prints DB rows; `verify_data.py` asserts the expected breach set. Revenue accounts now carry reconciling subledger detail. Agent/MCP/UI/evals still untouched.

## 2026-10-06 — Slice 3 policy.yaml thresholds

- **Decision:** Centralize variance thresholds, optional per-account overrides, and confidence cutoff placeholders in `config/policy.yaml`. Agent/MCP tools load via `policy.py` with validation; remove hardcoded threshold constants from Python. Close pass scans all entities/periods when flagging.
- **Why:** SPEC requires config in YAML, never hardcoded. Enables pytest to prove threshold changes alter the flagged set without touching anomaly data.
- **Implications:** Confidence high/med/low *mapping* remains slice 4 (cutoffs only stored now). `draft_flux_commentary(threshold=...)` still accepts an optional percent override; dollar threshold always comes from policy. Added deps: `pyyaml`, `pytest`.

## 2026-10-06 — Slice 4 confidence labels + unsupported JE policy

- **Decision:** Replace float confidence with **high / med / low** labels using `confidence.high_min` / `med_min` cutoffs in `policy.yaml`. Add `unsupported_je` rules so blank-description / no-vendor manual JEs are **always flagged** and **always routed to human review**, independent of dollar/percent thresholds. Agent never writes `approved` for low items; approve requires an explicit `reviewer_note` (human action).
- **Confidence mapping (evidence → score → label):**
  - **high** (`evidence_score >= high_min`, default 0.80): subledger drivers fully explain the variance and commentary cites specific txn IDs (duplicate accruals, reclass pairs, revenue timing JEs, labeled conference/hiring invoices).
  - **med** (`med_min <= score < high_min`): partial drivers / incomplete explanation.
  - **low** (`score < med_min`, or hard-capped): unexplained variance, **unsupported JE**, or **zero citations** (no txn IDs to cite ⇒ confidence capped at low).
- **Why:** Controllers need an explicit human gate for unsupported entries (A4) even when thresholds are raised, and explainable anomalies must show receipt-level citations.
- **Implications:** `assess_flux` + `draft_flux_commentary` return string labels; review queue stores TEXT confidence; Streamlit shows high/med/low; evals untouched aside from dropping a hardcoded default threshold fallback.

## 2026-10-06 — Fix-up: A1 = +$85K variance; add C1 (med)

- **Decision:** Restructure A1 so one Cloud Hosting accrual (`ACCR-CLOUD-6110-BASE`) is part of the baseline run rate and the identical twin (`ACCR-CLOUD-6110-DUP`) is the only TB add vs clean baseline — variance exactly **+$85K** (not +$170K). Add anomaly **C1**: ND-EU Software `6100` 2026-08 sticky ~+$90K, of which $60K is a labeled annual license renewal and ~$30K is an unexplained residual from a real vendor (no PO/contract match). C1 expected confidence **med**, queued for review; commentary must cite the $60K txn and state the residual amount. Breach set grows from 8 → **9** keys (C1 has no paired side).
- **Why:** Controllers need a clean “duplicate = full variance” narrative for A1, plus a med-band partial-explanation case before the review UI slice.
- **Implications:** `ANOMALIES.md`, `verify_data.EXPECTED_BREACHES`, policy/confidence tests, and generator/subledger overrides updated. Med now routes to human review alongside low.

## 2026-10-06 — Slice 5 Streamlit review UI polish

- **Decision:** Polish `ui/review_app.py` only (plus shared `ui/queue_helpers.py` and text verifier). Queue sorts **low → med → high**, then |variance| descending. Each card shows account, entity, period, variance ($/%), commentary, cited txn IDs, confidence, and policy rule (`threshold` / `unsupported_je`). Approve/edit/reject require a reviewer note in the UI; low approve remains API-blocked without a note. Status history is session-scoped; tool-call log tab maps each call to the close-pass item it served. No MCP / agent / eval changes.
- **Why:** Controllers need a review surface that surfaces risk order and evidence without leaving the demo.
- **Implications:** README demo checklist documents 9 pending items and what high/med/low look like. `ui/verify_queue_text.py` prints the queue for environments that cannot screenshot Streamlit.

## 2026-10-06 — Known limitation: paired anomalies are separate queue rows

- **Decision:** Leave A2/A2B and A3/A3B as **four separate** review-queue entries for now (not a merge blocker). Optionally add a small “group paired entries” polish before packaging so each offset side sits next to its original.
- **Why:** The offset side only makes sense beside the original; four independent cards are less realistic for a controller review, but confidence sort and evidence still work for the demo.
- **Implications:** Documented limitation only — no code change this turn. If we add grouping later, keep MCP/agent/evals untouched and sort groups by the worse confidence / larger |$| of the pair.

## 2026-10-06 — Slice 6 eval harness (stubs + scorer)

- **Decision:** Ship `evals/cases.yaml` with **stubs only** (planted A1–A4 / B1–B2 / C1 + A2B/A3B, plus 10 negative/adversarial rows). Pre-fill `must_cite` from DB txn ids; leave `expected_explanation`, `required_facts`, and `must_not_say` blank for the answer-key author. Replace `run_evals.py` with a deterministic scorer: confidence match, must_cite coverage, must_not_say avoidance, required_facts presence. No LLM-as-judge. Exit non-zero on incomplete answer key or any case failure. Pytest fails while explanation/facts are blank so incomplete cases cannot be scored. Do not publish a score in the README until the answer key is filled.
- **Why:** Separates harness machinery from gold labels so the author owns the answer key without agent/MCP/UI churn.
- **Implications:** Agent logic, MCP tools, and UI unchanged. Old `variance_eval_set.json` lexical scorer retired. `exports/eval_report.json` written by the runner for local inspection only.
