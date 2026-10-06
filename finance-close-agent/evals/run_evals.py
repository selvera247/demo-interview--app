#!/usr/bin/env python3
"""Score the close agent against evals/cases.yaml (deterministic, no LLM judge).

Per case checks:
  (a) confidence matches expected_confidence
  (b) commentary/citations include every must_cite txn id
  (c) commentary avoids every must_not_say phrase
  (d) commentary contains every required_fact

Exit non-zero if the answer key is incomplete or any case fails.
Does not write a score into the README.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools import draft_flux_commentary, reset_policy_cache  # noqa: E402

CASES_PATH = Path(__file__).resolve().parent / "cases.yaml"
REPORT_PATH = ROOT / "exports" / "eval_report.json"


def prior_period(period: str) -> str:
    y, m = map(int, period.split("-"))
    m -= 1
    if m == 0:
        y -= 1
        m = 12
    return f"{y:04d}-{m:02d}"


def load_cases(path: Path) -> list[dict]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or "cases" not in raw:
        raise ValueError(f"{path} must contain a top-level 'cases' list")
    cases = raw["cases"]
    if not isinstance(cases, list) or not cases:
        raise ValueError(f"{path}: cases must be a non-empty list")
    return cases


def _blank(value) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, list):
        return len(value) == 0
    return False


def incomplete_fields(case: dict) -> list[str]:
    """Answer-key fields that must be filled before scoring."""
    missing: list[str] = []
    if _blank(case.get("expected_explanation")):
        missing.append("expected_explanation")
    facts = case.get("required_facts")
    if facts is None or (isinstance(facts, list) and len(facts) == 0):
        missing.append("required_facts")
    return missing


def find_incomplete(cases: list[dict]) -> list[dict]:
    out = []
    for case in cases:
        missing = incomplete_fields(case)
        if missing:
            out.append({"id": case.get("id"), "missing": missing})
    return out


def _contains_cite(needle: str, citations: list[str], commentary: str) -> bool:
    needle = str(needle)
    if any(needle == c or needle in c or c in needle for c in citations):
        return True
    return needle.lower() in commentary.lower()


def score_case(case: dict) -> dict:
    """Run agent draft and score against the answer key. All four checks must pass."""
    account = str(case["account"])
    entity = case["entity"]
    period = str(case["period"])
    prior = prior_period(period)

    reset_policy_cache()
    draft = draft_flux_commentary(
        account,
        entity=entity,
        period=period,
        prior_period=prior,
    )
    commentary = draft.get("commentary") or ""
    citations = list(draft.get("citations") or [])
    confidence = draft.get("confidence")

    reasons: list[str] = []
    checks: dict[str, bool] = {}

    # (a) confidence
    expected_conf = (case.get("expected_confidence") or "").strip()
    conf_ok = bool(expected_conf) and confidence == expected_conf
    checks["confidence"] = conf_ok
    if not expected_conf:
        reasons.append("expected_confidence blank in answer key")
    elif not conf_ok:
        reasons.append(f"confidence: got {confidence!r}, expected {expected_conf!r}")

    # (b) must_cite
    must_cite = list(case.get("must_cite") or [])
    missing_cites = [
        c for c in must_cite if not _contains_cite(c, citations, commentary)
    ]
    cite_ok = not missing_cites
    checks["must_cite"] = cite_ok
    if missing_cites:
        reasons.append(f"missing citations: {missing_cites}")

    # (c) must_not_say
    must_not = list(case.get("must_not_say") or [])
    hit_forbidden = [
        p for p in must_not if p and str(p).lower() in commentary.lower()
    ]
    avoid_ok = not hit_forbidden
    checks["must_not_say"] = avoid_ok
    if hit_forbidden:
        reasons.append(f"must_not_say hit: {hit_forbidden}")

    # (d) required_facts
    required = list(case.get("required_facts") or [])
    missing_facts = [
        f for f in required if f and str(f).lower() not in commentary.lower()
    ]
    facts_ok = bool(required) and not missing_facts
    checks["required_facts"] = facts_ok
    if not required:
        reasons.append("required_facts empty in answer key")
    elif missing_facts:
        reasons.append(f"missing required_facts: {missing_facts}")

    passed = all(checks.values())
    return {
        "id": case.get("id"),
        "account": account,
        "entity": entity,
        "period": period,
        "passed": passed,
        "checks": checks,
        "reasons": reasons,
        "got_confidence": confidence,
        "expected_confidence": expected_conf or None,
        "citations": citations,
        "commentary": commentary,
    }


def run(cases_path: Path = CASES_PATH) -> dict:
    cases = load_cases(cases_path)
    incomplete = find_incomplete(cases)
    if incomplete:
        report = {
            "disclaimer": "SYNTHETIC DATA — Northwind Digital eval stubs only",
            "status": "incomplete_answer_key",
            "cases": len(cases),
            "incomplete": incomplete,
            "passed": 0,
            "failed": 0,
            "score": None,
            "message": (
                "Answer key incomplete — fill expected_explanation and "
                "required_facts for every case before scoring."
            ),
            "results": [],
        }
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
        return report

    results = [score_case(c) for c in cases]
    passed = sum(1 for r in results if r["passed"])
    failed = len(results) - passed
    score = round(passed / max(len(results), 1), 4)
    report = {
        "disclaimer": "SYNTHETIC DATA — Northwind Digital eval set only",
        "status": "scored",
        "cases": len(results),
        "passed": passed,
        "failed": failed,
        "score": score,
        "results": results,
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, default=CASES_PATH)
    args = parser.parse_args()
    report = run(args.cases)

    if report.get("status") == "incomplete_answer_key":
        print(json.dumps(
            {
                "status": report["status"],
                "cases": report["cases"],
                "incomplete": report["incomplete"],
                "message": report["message"],
            },
            indent=2,
        ))
        return 1

    print("=== Per-case results ===")
    for r in report["results"]:
        status = "PASS" if r["passed"] else "FAIL"
        why = "; ".join(r["reasons"]) if r["reasons"] else "all checks ok"
        print(
            f"{status} {r['id']}: {r['entity']} {r['account']} {r['period']} "
            f"— {why}"
        )
    print(
        f"\n=== Overall: {report['passed']}/{report['cases']} passed "
        f"(score={report['score']}) ==="
    )
    print(f"report: {REPORT_PATH}")
    return 0 if report["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
