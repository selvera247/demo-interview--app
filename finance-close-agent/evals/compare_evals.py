#!/usr/bin/env python3
"""Build a markdown comparison table from exports/{provider}_{model}_{suite}.json."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPORT_DIR = ROOT / "exports"
NAME_RE = re.compile(
    r"^(?P<provider>heuristic|openai|anthropic|xai|deepseek|ollama)"
    r"_(?P<model>.+)"
    r"_(?P<suite>planted|holdout|hard|sealed|custom)\.json$"
)


def load_reports(exports: Path) -> list[dict]:
    rows: list[dict] = []
    for path in sorted(exports.glob("*.json")):
        m = NAME_RE.match(path.name)
        if not m:
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        rows.append(
            {
                "path": str(path),
                "provider": data.get("provider") or m.group("provider"),
                "model": data.get("model") or m.group("model"),
                "suite": data.get("suite") or m.group("suite"),
                "date": data.get("date") or "",
                "passed": data.get("passed"),
                "scored": data.get("cases_scored"),
                "score": data.get("score"),
                "citation_errors": data.get("citation_error_count"),
                "fallbacks": data.get("fallback_count"),
                "latency_ms_mean": data.get("latency_ms_mean"),
                "tokens": data.get("token_usage_total"),
            }
        )
    return rows


def to_markdown(rows: list[dict]) -> str:
    headers = [
        "provider",
        "model",
        "suite",
        "date",
        "passed",
        "score",
        "citation_errors",
        "fallbacks",
        "latency_ms_mean",
        "tokens",
    ]
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    for r in rows:
        passed = r["passed"]
        scored = r["scored"]
        passed_cell = f"{passed}/{scored}" if passed is not None and scored else ""
        score = "" if r["score"] is None else f"{r['score']:.4f}"
        lat = "" if r["latency_ms_mean"] is None else str(r["latency_ms_mean"])
        tok = "" if r["tokens"] is None else str(r["tokens"])
        cells = [
            str(r["provider"]),
            str(r["model"]),
            str(r["suite"]),
            str(r["date"]),
            passed_cell,
            score,
            str(r["citation_errors"] if r["citation_errors"] is not None else ""),
            str(r["fallbacks"] if r["fallbacks"] is not None else ""),
            lat,
            tok,
        ]
        lines.append("| " + " | ".join(cells) + " |")
    if len(rows) == 0:
        lines.append("| _(no matching export reports)_ | | | | | | | | | |")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--exports",
        type=Path,
        default=EXPORT_DIR,
        help="Directory of eval JSON reports (default: exports/)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Write markdown here (default: stdout)",
    )
    args = parser.parse_args()
    md = to_markdown(load_reports(args.exports))
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(md, encoding="utf-8")
        print(f"wrote {args.out}")
    else:
        print(md, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
