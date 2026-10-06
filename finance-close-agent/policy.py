"""Load and validate close-agent policy from config/policy.yaml."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent
DEFAULT_POLICY_PATH = ROOT / "config" / "policy.yaml"

REQUIRED_TOP_KEYS = ("variance", "account_overrides", "confidence")
REQUIRED_VARIANCE_KEYS = ("threshold_pct", "threshold_amt", "require_both")
REQUIRED_CONFIDENCE_KEYS = ("high_min", "med_min", "low_routes_to_human_review")


class PolicyError(ValueError):
    """Raised when policy YAML is missing or invalid."""


@dataclass(frozen=True)
class Thresholds:
    threshold_pct: float
    threshold_amt: float
    require_both: bool = True


@dataclass(frozen=True)
class ConfidencePolicy:
    high_min: float
    med_min: float
    low_routes_to_human_review: bool


@dataclass(frozen=True)
class Policy:
    variance: Thresholds
    account_overrides: dict[str, Thresholds]
    confidence: ConfidencePolicy
    source_path: Path

    def thresholds_for(self, account_id: str) -> Thresholds:
        return self.account_overrides.get(account_id, self.variance)

    def is_over_threshold(
        self,
        account_id: str,
        variance_pct: float,
        variance_amt: float,
    ) -> bool:
        t = self.thresholds_for(account_id)
        pct_hit = abs(variance_pct) > t.threshold_pct
        amt_hit = abs(variance_amt) > t.threshold_amt
        if t.require_both:
            return pct_hit and amt_hit
        return pct_hit or amt_hit


def _require_mapping(data: Any, label: str) -> dict:
    if not isinstance(data, dict):
        raise PolicyError(f"Policy '{label}' must be a mapping, got {type(data).__name__}")
    return data


def _require_keys(data: dict, keys: tuple[str, ...], label: str) -> None:
    missing = [k for k in keys if k not in data]
    if missing:
        raise PolicyError(f"Policy '{label}' missing required keys: {missing}")


def _as_float(value: Any, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise PolicyError(f"Policy '{label}' must be a number, got {value!r}")
    return float(value)


def _as_bool(value: Any, label: str) -> bool:
    if not isinstance(value, bool):
        raise PolicyError(f"Policy '{label}' must be a boolean, got {value!r}")
    return value


def _parse_thresholds(data: dict, label: str) -> Thresholds:
    _require_keys(data, REQUIRED_VARIANCE_KEYS, label)
    pct = _as_float(data["threshold_pct"], f"{label}.threshold_pct")
    amt = _as_float(data["threshold_amt"], f"{label}.threshold_amt")
    both = _as_bool(data["require_both"], f"{label}.require_both")
    if pct < 0 or amt < 0:
        raise PolicyError(f"Policy '{label}' thresholds must be non-negative")
    return Thresholds(threshold_pct=pct, threshold_amt=amt, require_both=both)


def load_policy(path: Path | str | None = None) -> Policy:
    """Load policy YAML. Raises PolicyError on missing file or invalid shape."""
    policy_path = Path(path) if path else DEFAULT_POLICY_PATH
    if not policy_path.exists():
        raise PolicyError(f"Policy file not found: {policy_path}")

    try:
        raw = yaml.safe_load(policy_path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise PolicyError(f"Policy YAML parse error in {policy_path}: {exc}") from exc

    data = _require_mapping(raw, "root")
    _require_keys(data, REQUIRED_TOP_KEYS, "root")

    variance = _parse_thresholds(
        _require_mapping(data["variance"], "variance"), "variance"
    )

    overrides_raw = _require_mapping(data["account_overrides"], "account_overrides")
    overrides: dict[str, Thresholds] = {}
    for account_id, ov in overrides_raw.items():
        if not isinstance(account_id, str) or not account_id:
            raise PolicyError(f"Invalid account_overrides key: {account_id!r}")
        ov_map = _require_mapping(ov, f"account_overrides.{account_id}")
        # Allow partial overrides by filling from defaults
        merged = {
            "threshold_pct": ov_map.get("threshold_pct", variance.threshold_pct),
            "threshold_amt": ov_map.get("threshold_amt", variance.threshold_amt),
            "require_both": ov_map.get("require_both", variance.require_both),
        }
        overrides[account_id] = _parse_thresholds(
            merged, f"account_overrides.{account_id}"
        )

    conf_raw = _require_mapping(data["confidence"], "confidence")
    _require_keys(conf_raw, REQUIRED_CONFIDENCE_KEYS, "confidence")
    high_min = _as_float(conf_raw["high_min"], "confidence.high_min")
    med_min = _as_float(conf_raw["med_min"], "confidence.med_min")
    if not (0.0 <= med_min <= high_min <= 1.0):
        raise PolicyError(
            "confidence cutoffs must satisfy 0 <= med_min <= high_min <= 1"
        )
    confidence = ConfidencePolicy(
        high_min=high_min,
        med_min=med_min,
        low_routes_to_human_review=_as_bool(
            conf_raw["low_routes_to_human_review"],
            "confidence.low_routes_to_human_review",
        ),
    )

    return Policy(
        variance=variance,
        account_overrides=overrides,
        confidence=confidence,
        source_path=policy_path.resolve(),
    )


def iter_mom_variances(conn) -> list[dict[str, Any]]:
    """Return MoM variance rows for every entity/account/consecutive period pair."""
    entities = [
        r[0]
        for r in conn.execute(
            "SELECT DISTINCT entity FROM trial_balance ORDER BY entity"
        )
    ]
    periods = [
        r[0]
        for r in conn.execute(
            "SELECT DISTINCT period FROM trial_balance ORDER BY period"
        )
    ]
    out: list[dict[str, Any]] = []
    for entity in entities:
        for i in range(1, len(periods)):
            period_a, period_b = periods[i - 1], periods[i]
            rows = conn.execute(
                """
                SELECT a.account_id,
                       acct.name AS account_name,
                       a.ending_balance AS balance_a,
                       b.ending_balance AS balance_b
                FROM trial_balance a
                JOIN trial_balance b
                  ON b.account_id = a.account_id AND b.entity = a.entity
                JOIN accounts acct ON acct.account_id = a.account_id
                WHERE a.entity = ? AND a.period = ? AND b.period = ?
                """,
                (entity, period_a, period_b),
            ).fetchall()
            for r in rows:
                bal_a = float(r[2] if not hasattr(r, "keys") else r["balance_a"])
                bal_b = float(r[3] if not hasattr(r, "keys") else r["balance_b"])
                account_id = r[0] if not hasattr(r, "keys") else r["account_id"]
                account_name = r[1] if not hasattr(r, "keys") else r["account_name"]
                delta = bal_b - bal_a
                pct = (delta / bal_a) if abs(bal_a) > 1 else (1.0 if abs(delta) else 0.0)
                out.append(
                    {
                        "account": account_id,
                        "account_id": account_id,
                        "account_name": account_name,
                        "entity": entity,
                        "period_a": period_a,
                        "period_b": period_b,
                        "balance_a": bal_a,
                        "balance_b": bal_b,
                        "variance_amt": round(delta, 2),
                        "variance_pct": round(pct, 4),
                    }
                )
    return out


def flag_variances(policy: Policy, conn) -> list[dict[str, Any]]:
    """Apply policy thresholds to all MoM variances; return flagged rows."""
    flagged: list[dict[str, Any]] = []
    for row in iter_mom_variances(conn):
        thr = policy.thresholds_for(row["account_id"])
        over = policy.is_over_threshold(
            row["account_id"], row["variance_pct"], row["variance_amt"]
        )
        if over:
            flagged.append(
                {
                    **row,
                    "over_threshold": True,
                    "threshold_pct": thr.threshold_pct,
                    "threshold_amt": thr.threshold_amt,
                }
            )
    return flagged
