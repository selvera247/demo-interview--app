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
