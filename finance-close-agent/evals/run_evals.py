#!/usr/bin/env python3
"""Score the heuristic close agent against the planted variance eval set."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools import draft_flux_commentary, get_account_variance  # noqa: E402

EVAL_PATH = Path(__file__).resolve().parent / "variance_eval_set.json"


def tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9\-]+", text.lower()))


def score_case(case: dict) -> dict:
    account = case["account_id"]
    entity = case.get("entity", "US-01")
    period_a = case["period_a"]
    period_b = case["period_b"]
    gold = case["gold_explanation"]
    must_cite = case.get("must_cite") or []

    variance = get_account_variance(account, period_a, period_b, entity=entity)
    draft = draft_flux_commentary(
        account,
        threshold=case.get("threshold_pct", 0.10),
        entity=entity,
        period=period_b,
        prior_period=period_a,
    )

    commentary = draft.get("commentary", "")
    citations = set(draft.get("citations") or [])
    gold_tokens = tokenize(gold)
    pred_tokens = tokenize(commentary)
    overlap = len(gold_tokens & pred_tokens) / max(len(gold_tokens), 1)

    cite_hits = 0
    for c in must_cite:
        if c in citations or c.lower() in commentary.lower():
            cite_hits += 1
    cite_score = 1.0 if not must_cite else cite_hits / len(must_cite)

    # Accuracy: citation coverage (if required) + lexical overlap with gold driver
    accuracy = 0.6 * cite_score + 0.4 * min(overlap / 0.25, 1.0)

    # Planted anomaly kinds should be over threshold; benign below_threshold should not
    kind = case.get("kind")
    threshold_ok = True
    if kind in {"duplicate_accrual", "reclass", "revenue_timing"}:
        threshold_ok = bool(variance.get("over_threshold"))
    elif kind == "below_threshold":
        threshold_ok = not bool(variance.get("over_threshold"))

    if not threshold_ok:
        accuracy *= 0.5

    passed = accuracy >= 0.55
    return {
        "case_id": case["case_id"],
        "account_id": account,
        "kind": kind,
        "accuracy": round(accuracy, 3),
        "cite_score": round(cite_score, 3),
        "overlap": round(overlap, 3),
        "passed": passed,
        "commentary": commentary,
    }


def run(eval_path: Path = EVAL_PATH) -> dict:
    cases = json.loads(eval_path.read_text(encoding="utf-8"))
    results = [score_case(c) for c in cases]
    passed = sum(1 for r in results if r["passed"])
    avg = sum(r["accuracy"] for r in results) / max(len(results), 1)
    report = {
        "disclaimer": "Eval set uses synthetic planted anomalies only.",
        "cases": len(results),
        "passed": passed,
        "accuracy": round(avg, 3),
        "pass_rate": round(passed / max(len(results), 1), 3),
        "results": results,
    }
    out = ROOT / "exports" / "eval_report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--eval-set", type=Path, default=EVAL_PATH)
    args = parser.parse_args()
    report = run(args.eval_set)
    summary = {
        k: report[k] for k in ("disclaimer", "cases", "passed", "accuracy", "pass_rate")
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
