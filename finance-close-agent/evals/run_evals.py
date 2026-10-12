#!/usr/bin/env python3
"""Score the close agent against eval suites (deterministic, no LLM judge).

Per case checks (when the answer key is filled):
  (a) confidence matches expected_confidence
  (b) commentary/citations include every must_cite txn id
  (c) commentary avoids every must_not_say phrase
  (d) commentary contains every required_fact
  (e) if expected_flagged is set: over_threshold / unsupported matches

required_facts may use ``|`` alternatives (any one match passes).
Numeric facts match within ``numeric_tolerance_amt`` (evals/config.yaml),
including against the sum of amounts mentioned in the commentary.

False-positive-only stubs (expected_flagged: false, blank explanation/facts)
are scored on the flagged check alone.

Suites: planted | holdout | hard | sealed | all
Providers: from config/llm.yaml (default heuristic). Sealed refuses without
``--confirm-sealed``.

Does not write a score into the README. Do not edit answer keys to force passes.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools import draft_flux_commentary, reset_policy_cache, set_llm_provider  # noqa: E402
import db as db_mod  # noqa: E402
from llm import load_llm_config  # noqa: E402

EVALS_DIR = Path(__file__).resolve().parent
CASES_PATH = EVALS_DIR / "cases.yaml"
CONFIG_PATH = EVALS_DIR / "config.yaml"
EXPORT_DIR = ROOT / "exports"
REPORT_PATH = EXPORT_DIR / "eval_report.json"

PLANTED_IDS = {"A1", "A2", "A2B", "A3", "A3B", "A4", "B1", "B2", "C1"}

SUITE_SPECS: dict[str, dict] = {
    "planted": {
        "cases": EVALS_DIR / "cases.yaml",
        "db": ROOT / "data" / "finance.db",
        "case_ids": PLANTED_IDS,
    },
    "holdout": {
        "cases": EVALS_DIR / "holdout_cases.yaml",
        "db": ROOT / "data" / "finance_holdout.db",
        "case_ids": None,
    },
    "hard": {
        "cases": EVALS_DIR / "hard_cases.yaml",
        "db": ROOT / "data" / "finance.db",
        "case_ids": None,
    },
    "sealed": {
        "cases": EVALS_DIR / "sealed_cases.yaml",
        "db": ROOT / "data" / "finance_sealed.db",
        "case_ids": None,
        "requires_confirm": True,
    },
}

DEFAULT_NUMERIC_TOLERANCE = 500.0
AMOUNT_RE = re.compile(
    r"(?<![\w-])([+-]?\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[+-]?\$?\d+(?:\.\d+)?)(?![\w-])"
)


def prior_period(period: str) -> str:
    y, m = map(int, period.split("-"))
    m -= 1
    if m == 0:
        y -= 1
        m = 12
    return f"{y:04d}-{m:02d}"


def load_eval_config(path: Path = CONFIG_PATH) -> dict:
    if not path.exists():
        return {"numeric_tolerance_amt": DEFAULT_NUMERIC_TOLERANCE}
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    tol = raw.get("numeric_tolerance_amt", DEFAULT_NUMERIC_TOLERANCE)
    return {"numeric_tolerance_amt": float(tol)}


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


def is_false_positive_only(case: dict) -> bool:
    """expected_flagged explicitly false with no written answer key yet."""
    return case.get("expected_flagged") is False and _blank(
        case.get("expected_explanation")
    )


def is_stub_structural(case: dict) -> bool:
    """Planted stub: flagged expectation set, answer-key prose still blank."""
    return case.get("expected_flagged") is not None and _blank(
        case.get("expected_explanation")
    )


def incomplete_fields(case: dict) -> list[str]:
    """Answer-key fields that must be filled before full / published scoring.

    Stubs with ``expected_flagged`` set (true or false) are scorable on
    structural checks (flagged + must_cite) without prose yet.
    """
    if is_stub_structural(case):
        return []
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


def normalize_text(text: str) -> str:
    """Lowercase; strip $ and thousands separators so amount facts match flexibly."""
    t = (text or "").lower()
    t = t.replace("$", "")
    t = re.sub(r"(?<=\d),(?=\d{3}\b)", "", t)
    return t


def parse_amount(token: str) -> float | None:
    s = str(token).strip().replace("$", "").replace(",", "")
    if not re.fullmatch(r"[+-]?\d+(?:\.\d+)?", s):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def extract_amounts(text: str) -> list[float]:
    found: list[float] = []
    for m in AMOUNT_RE.finditer(text or ""):
        raw = m.group(1).replace("$", "").replace(",", "")
        try:
            found.append(float(raw))
        except ValueError:
            continue
    return found


def _contains_cite(needle: str, citations: list[str], commentary: str) -> bool:
    needle = str(needle)
    if any(needle == c or needle in c or c in needle for c in citations):
        return True
    return needle.lower() in commentary.lower()


def fact_matches(fact: str, commentary: str, tolerance: float) -> bool:
    """Pass if any ``|`` alternative matches as text or (for numbers) within tolerance."""
    alts = [a.strip() for a in str(fact).split("|") if a.strip()]
    norm_commentary = normalize_text(commentary)
    amounts = extract_amounts(commentary)

    def near(value: float, target: float) -> bool:
        return abs(abs(value) - abs(target)) <= tolerance

    for alt in alts:
        target = parse_amount(normalize_text(alt).replace(" ", ""))
        if target is not None:
            for num in amounts:
                if near(num, target):
                    return True
            # Split invoices: any pair of amounts may sum to the planted total
            for i, a in enumerate(amounts):
                for b in amounts[i + 1 :]:
                    if near(abs(a) + abs(b), target):
                        return True
            if normalize_text(alt) in norm_commentary:
                return True
            continue
        if normalize_text(alt) in norm_commentary:
            return True
    return False


def score_case(case: dict, tolerance: float = DEFAULT_NUMERIC_TOLERANCE) -> dict:
    """Run agent draft and score against the answer key."""
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
    over_threshold = bool(draft.get("over_threshold"))
    unsupported = bool(draft.get("unsupported_je"))
    got_flagged = over_threshold or unsupported
    draft_meta = draft.get("draft_meta") or {}

    reasons: list[str] = []
    checks: dict[str, bool] = {}

    # (e) expected_flagged
    expected_flagged = case.get("expected_flagged")
    if expected_flagged is None:
        checks["flagged"] = True
    else:
        want = bool(expected_flagged)
        flag_ok = got_flagged == want
        checks["flagged"] = flag_ok
        if not flag_ok:
            reasons.append(
                f"flagged: got {got_flagged}, expected {want} "
                f"(over_threshold={over_threshold}, unsupported_je={unsupported})"
            )

    # False-positive-only / structural stubs: limited checks until answer key filled
    if is_stub_structural(case):
        must_cite = list(case.get("must_cite") or [])
        missing_cites = [
            c for c in must_cite if not _contains_cite(c, citations, commentary)
        ]
        cite_ok = not missing_cites
        checks["must_cite"] = cite_ok
        if missing_cites:
            reasons.append(f"missing citations: {missing_cites}")
        passed = all(checks.values())
        mode = (
            "false_positive_only"
            if case.get("expected_flagged") is False
            else "stub_structural"
        )
        return {
            "id": case.get("id"),
            "account": account,
            "entity": entity,
            "period": period,
            "passed": passed,
            "checks": checks,
            "reasons": reasons,
            "got_confidence": confidence,
            "expected_confidence": None,
            "got_flagged": got_flagged,
            "expected_flagged": expected_flagged,
            "citations": citations,
            "commentary": commentary,
            "mode": mode,
            "citation_errors": list(draft_meta.get("citation_errors") or []),
            "fallback": bool(draft_meta.get("fallback")),
            "latency_ms": draft_meta.get("latency_ms"),
            "usage": draft_meta.get("usage"),
            "provider": draft_meta.get("provider"),
        }

    # (a) confidence
    expected_conf = (case.get("expected_confidence") or "").strip()
    if expected_conf:
        conf_ok = confidence == expected_conf
        checks["confidence"] = conf_ok
        if not conf_ok:
            reasons.append(
                f"confidence: got {confidence!r}, expected {expected_conf!r}"
            )
    else:
        checks["confidence"] = False
        reasons.append("expected_confidence blank in answer key")

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
        p
        for p in must_not
        if p and normalize_text(str(p)) in normalize_text(commentary)
    ]
    avoid_ok = not hit_forbidden
    checks["must_not_say"] = avoid_ok
    if hit_forbidden:
        reasons.append(f"must_not_say hit: {hit_forbidden}")

    # (d) required_facts — OR-alternatives + numeric tolerance
    required = list(case.get("required_facts") or [])
    missing_facts = [
        f for f in required if f and not fact_matches(f, commentary, tolerance)
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
        "got_flagged": got_flagged,
        "expected_flagged": expected_flagged,
        "citations": citations,
        "commentary": commentary,
        "mode": "full",
        "citation_errors": list(draft_meta.get("citation_errors") or []),
        "fallback": bool(draft_meta.get("fallback")),
        "latency_ms": draft_meta.get("latency_ms"),
        "usage": draft_meta.get("usage"),
        "provider": draft_meta.get("provider"),
    }


def _model_slug(provider_name: str) -> str:
    cfg = load_llm_config()
    block = (cfg.get("providers") or {}).get(provider_name) or {}
    model = block.get("model") or provider_name
    # Safe filename fragment
    return re.sub(r"[^\w.-]+", "_", str(model))


def resolve_report_path(provider: str, suite: str, report_path: Path | None) -> Path:
    if report_path is not None:
        return report_path
    model = _model_slug(provider)
    return EXPORT_DIR / f"{provider}_{model}_{suite}.json"


def run_suite(
    suite: str,
    provider: str = "heuristic",
    report_path: Path | None = None,
    confirm_sealed: bool = False,
    cases_path: Path | None = None,
    db_path: Path | None = None,
) -> dict:
    if suite not in SUITE_SPECS:
        raise ValueError(f"unknown suite {suite!r}; known: {sorted(SUITE_SPECS)}")
    spec = SUITE_SPECS[suite]
    if spec.get("requires_confirm") and not confirm_sealed:
        raise SystemExit(
            "Refusing to run sealed suite without --confirm-sealed "
            "(answer key is author-owned; do not score until confirmed)."
        )

    set_llm_provider(provider)
    out_path = resolve_report_path(provider, suite, report_path)
    chosen_db = Path(db_path) if db_path else Path(spec["db"])
    chosen_cases = Path(cases_path) if cases_path else Path(spec["cases"])
    db_mod.DB_PATH = chosen_db

    cases = load_cases(chosen_cases)
    id_filter = spec.get("case_ids")
    if id_filter is not None:
        cases = [c for c in cases if c.get("id") in id_filter]

    cfg = load_eval_config()
    tolerance = cfg["numeric_tolerance_amt"]
    incomplete = find_incomplete(cases)
    complete = [c for c in cases if not incomplete_fields(c)]

    results = [score_case(c, tolerance=tolerance) for c in complete]
    passed = sum(1 for r in results if r["passed"])
    failed = len(results) - passed
    score = round(passed / max(len(results), 1), 4) if results else None
    citation_error_count = sum(len(r.get("citation_errors") or []) for r in results)
    fallback_count = sum(1 for r in results if r.get("fallback"))
    latencies = [r["latency_ms"] for r in results if r.get("latency_ms") is not None]
    total_tokens = 0
    token_available = False
    for r in results:
        usage = r.get("usage") or {}
        if usage.get("total_tokens") is not None:
            token_available = True
            total_tokens += int(usage["total_tokens"])

    status = "scored"
    if incomplete and not results:
        status = "incomplete_answer_key"
    elif incomplete:
        status = "partial_answer_key"

    model = _model_slug(provider)
    report = {
        "disclaimer": "SYNTHETIC DATA — Northwind Digital eval set only",
        "status": status,
        "provider": provider,
        "model": model,
        "suite": suite,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "db_path": str(db_mod.DB_PATH),
        "cases_path": str(chosen_cases),
        "numeric_tolerance_amt": tolerance,
        "cases_total": len(cases),
        "cases_scored": len(results),
        "incomplete": incomplete,
        "passed": passed,
        "failed": failed,
        "score": score,
        "citation_error_count": citation_error_count,
        "fallback_count": fallback_count,
        "latency_ms_total": round(sum(latencies), 1) if latencies else None,
        "latency_ms_mean": round(sum(latencies) / len(latencies), 1) if latencies else None,
        "token_usage_total": total_tokens if token_available else None,
        "results": results,
    }
    if incomplete:
        report["message"] = (
            "Some cases still lack expected_explanation / required_facts; "
            "scored complete / false-positive-only cases. Fill remaining stubs "
            "before publishing."
        )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    report["report_path"] = str(out_path)
    return report


def run(
    cases_path: Path | None = None,
    db_path: Path | None = None,
    report_path: Path | None = None,
    provider: str = "heuristic",
    suite: str | None = None,
    confirm_sealed: bool = False,
) -> dict:
    """Back-compat entry: single suite or legacy --cases/--db/--report."""
    if suite is None:
        # Legacy path: treat as a one-off custom run (suite label = custom)
        suite_label = "custom"
        set_llm_provider(provider)
        if db_path is not None:
            db_mod.DB_PATH = Path(db_path)
        cases = load_cases(cases_path or (EVALS_DIR / "cases.yaml"))
        cfg = load_eval_config()
        tolerance = cfg["numeric_tolerance_amt"]
        incomplete = find_incomplete(cases)
        complete = [c for c in cases if not incomplete_fields(c)]
        results = [score_case(c, tolerance=tolerance) for c in complete]
        passed = sum(1 for r in results if r["passed"])
        out_path = report_path or (EXPORT_DIR / "eval_report.json")
        report = {
            "disclaimer": "SYNTHETIC DATA — Northwind Digital eval set only",
            "status": "scored" if results else "incomplete_answer_key",
            "provider": provider,
            "model": _model_slug(provider),
            "suite": suite_label,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "db_path": str(db_mod.DB_PATH),
            "cases_path": str(cases_path or (EVALS_DIR / "cases.yaml")),
            "numeric_tolerance_amt": tolerance,
            "cases_total": len(cases),
            "cases_scored": len(results),
            "incomplete": incomplete,
            "passed": passed,
            "failed": len(results) - passed,
            "score": round(passed / max(len(results), 1), 4) if results else None,
            "citation_error_count": sum(
                len(r.get("citation_errors") or []) for r in results
            ),
            "fallback_count": sum(1 for r in results if r.get("fallback")),
            "results": results,
        }
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        report["report_path"] = str(out_path)
        return report

    return run_suite(
        suite,
        provider=provider,
        report_path=report_path,
        confirm_sealed=confirm_sealed,
        cases_path=cases_path,
        db_path=db_path,
    )


def _print_report(report: dict) -> None:
    if report.get("incomplete"):
        print(
            f"Incomplete answer key ({len(report['incomplete'])} cases): "
            f"{[x['id'] for x in report['incomplete']]}"
        )
    if not report.get("results"):
        print(
            json.dumps(
                {
                    "status": report["status"],
                    "incomplete": report.get("incomplete"),
                    "message": report.get("message"),
                },
                indent=2,
            )
        )
        return

    print(
        f"=== {report.get('suite')} / {report.get('provider')} "
        f"({report.get('model')}) tol=${report['numeric_tolerance_amt']:,.0f}; "
        f"db={report['db_path']} ==="
    )
    for r in report["results"]:
        status = "PASS" if r["passed"] else "FAIL"
        why = "; ".join(r["reasons"]) if r["reasons"] else "all checks ok"
        mode = r.get("mode", "")
        print(
            f"{status} {r['id']}: {r['entity']} {r['account']} {r['period']} "
            f"[{mode}] — {why}"
        )
        if not r["passed"]:
            print(f"     commentary: {(r.get('commentary') or '')[:220]}…")

    print(
        f"\n=== Overall (scored): {report['passed']}/{report['cases_scored']} "
        f"passed (score={report['score']}); "
        f"citation_errors={report.get('citation_error_count')}; "
        f"fallbacks={report.get('fallback_count')}; "
        f"{len(report.get('incomplete') or [])} incomplete / "
        f"{report['cases_total']} total ==="
    )
    print(f"report: {report.get('report_path')}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--provider",
        default=None,
        help="LLM provider (config/llm.yaml). Default: heuristic / LLM_PROVIDER",
    )
    parser.add_argument(
        "--suite",
        choices=("planted", "holdout", "hard", "sealed", "all"),
        default=None,
        help="Eval suite. Prefer this over --cases/--db for standard runs.",
    )
    parser.add_argument(
        "--confirm-sealed",
        action="store_true",
        help="Required to run the sealed suite (author-owned answer key).",
    )
    parser.add_argument("--cases", type=Path, default=None)
    parser.add_argument(
        "--db",
        type=Path,
        default=None,
        help="SQLite path override (default from suite).",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=None,
        help="Write JSON report here (default: exports/{provider}_{model}_{suite}.json)",
    )
    args = parser.parse_args()

    provider = args.provider or load_llm_config().get("default_provider") or "heuristic"

    suites: list[str]
    if args.suite == "all":
        suites = ["planted", "holdout", "hard"]
        # sealed excluded from 'all' unless explicitly confirmed alone
    elif args.suite:
        suites = [args.suite]
    else:
        # Legacy: single custom run
        report = run(
            cases_path=args.cases,
            db_path=args.db,
            report_path=args.report,
            provider=provider,
            suite=None,
            confirm_sealed=args.confirm_sealed,
        )
        _print_report(report)
        if report.get("failed") or report.get("incomplete"):
            return 1
        return 0

    exit_code = 0
    for suite in suites:
        try:
            report = run_suite(
                suite,
                provider=provider,
                report_path=args.report if len(suites) == 1 else None,
                confirm_sealed=args.confirm_sealed,
                cases_path=args.cases if len(suites) == 1 else None,
                db_path=args.db if len(suites) == 1 else None,
            )
        except SystemExit as exc:
            print(str(exc) or "refused", file=sys.stderr)
            return 2
        _print_report(report)
        print()
        if report.get("failed") or report.get("incomplete"):
            exit_code = 1
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
