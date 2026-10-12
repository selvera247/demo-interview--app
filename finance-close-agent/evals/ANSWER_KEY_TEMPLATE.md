# Eval answer-key template (author you)

Fill rows in `evals/cases.yaml`. Do **not** ask the agent/generator to invent gold labels.

## Status today

| Cohort | Cases | What’s already set | What’s left for you |
| --- | --- | --- | --- |
| Planted | A1–A4, A2B, A3B, B1–B2, C1 | Full answer key | Optional polish only |
| Negative / edge | N01–N14 | `expected_flagged: false` | Optional **full** key (see below). Harness already scores these in **false-positive-only** mode (flag check only) while `expected_explanation` stays blank. |

Publish a README/UI score only when `python evals/run_evals.py` exits **0** (all scored cases pass, none incomplete).

---

## Field reference

| Field | Required when | Meaning |
| --- | --- | --- |
| `id` | always | Stable case id (`N01`, …) |
| `account` | always | Account id string |
| `entity` | always | `ND-US` or `ND-EU` |
| `period` | always | `YYYY-MM` (MoM vs prior month) |
| `variance` | optional | Documented $ MoM for humans; not scored |
| `expected_flagged` | always | `true` / `false` — did policy breach or unsupported JE fire? |
| `expected_confidence` | full key only | `high` \| `med` \| `low` |
| `expected_explanation` | full key only | 1–3 sentence controller-truth narrative |
| `required_facts` | full key only | Substrings (or `alt1\|alt2`) that must appear in commentary; amounts ±$500 |
| `must_cite` | full key only | Txn ids that must appear in citations or commentary |
| `must_not_say` | recommended | Forbidden phrases (hallucinated drivers) |
| `notes` | optional | Why this case exists (not scored) |

**False-positive-only mode** (current N stubs): `expected_flagged: false` + blank `expected_explanation` → harness only checks the agent **does not flag**.

**Full mode**: non-blank `expected_explanation` + non-empty `required_facts` → also checks confidence, cites, facts, must_not_say.

---

## Copy-paste: negative case (minimum — keep FP-only)

Use when the story is “should stay quiet.” Leave explanation blank.

```yaml
  - id: N0X
    account: "XXXX"
    entity: ND-US   # or ND-EU
    period: "YYYY-MM"
    variance: null  # or documented MoM $
    expected_flagged: false
    expected_explanation: ""
    expected_confidence: ""
    required_facts: []
    must_cite: []
    must_not_say: []
    notes: >
      Why this period/account is a good negative (under threshold, clean month, etc.).
```

## Copy-paste: negative / edge case (full answer key)

Use when you want the commentary graded too (still expect no flag).

```yaml
  - id: N0X
    account: "XXXX"
    entity: ND-US
    period: "YYYY-MM"
    variance: 12345.67
    expected_flagged: false
    expected_confidence: high   # or med/low if you expect a draft label when forced
    expected_explanation: >
      MoM move is under the dual threshold (>10% AND >$50K), so no flux flag.
      Subledger shows routine activity only; no duplicate/reclass/timing exception.
    required_facts:
      - "under threshold|no material variance|within policy"
      - "12345|12,345"          # optional amount fact; | for alternatives
    must_cite: []               # usually empty for clean negatives
    must_not_say:
      - "duplicate"
      - "reclass"
      - "usage growth"
    notes: >
      Author rationale for hiring-manager story.
```

## Copy-paste: planted positive (reference — already filled for A/B/C)

```yaml
  - id: A1
    account: "6110"
    entity: ND-US
    period: "2026-06"
    variance: 81419.97
    expected_flagged: true
    expected_confidence: high
    expected_explanation: >
      Cloud Hosting was accrued twice in June for the same vendor and
      reference, $85,000 each. The second is a duplicate and should be reversed.
    required_facts: ["duplicate", "85,000"]
    must_cite:
      - ACCR-CLOUD-6110-BASE-2026-06
      - ACCR-CLOUD-6110-DUP-2026-06
    must_not_say: ["usage growth", "increased consumption", "new workload"]
    notes: ""
```

---

## Checklist for N01–N14 (your pass)

For each id, open the account/period in SQLite or Streamlit and decide:

1. **Flag?** Confirm MoM is under `>10% AND >$50K` and no unsupported JE → keep `expected_flagged: false`.
2. **Minimum path:** leave explanation blank (FP-only) — good enough to score “no false positives.”
3. **Stronger path (recommended before publishing):** write `expected_explanation`, 1–3 `required_facts`, and `must_not_say` so a chatty model can’t invent a planted-style driver.
4. **N11–N14** already have `notes` describing the edge — turn those notes into `expected_explanation` / `required_facts` when you upgrade to full mode.
5. Re-run: `python evals/run_evals.py` → exit 0 before putting a % in the README/UI.

### Suggested facts for edge stubs (starter text — edit in your voice)

| Id | Starter `required_facts` (full mode) | Starter `must_not_say` |
| --- | --- | --- |
| N11 | `under threshold\|not flagged`, `percent\|%` | `duplicate`, `reclass` |
| N12 | `under threshold\|within policy`, `Contractors` | `duplicate`, `reclass` |
| N13 | `under threshold\|not material`, `50,000\|threshold` | `duplicate`, `timing` |
| N14 | `seasonal\|marketing`, `under threshold` | `new campaign spend spike` (unless true) |
| N01–N10 | `under threshold\|no material variance` | `duplicate`, `reclass`, `usage growth` |

---

## How to validate one case while authoring

```bash
cd finance-close-agent
python - <<'PY'
from tools import draft_flux_commentary, reset_policy_cache
reset_policy_cache()
print(draft_flux_commentary("4000", entity="ND-US", period="2024-11", prior_period="2024-10"))
PY
python evals/run_evals.py
```
