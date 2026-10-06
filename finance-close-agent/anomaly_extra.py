"""Extra anomaly plants: hard variants, small-account edge (S1), holdout profile.

Used by generate_data.py. Does not change agent / MCP / UI logic.
"""

from __future__ import annotations

import random
from datetime import date, timedelta
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from generate_data import AnomalyRecord


def _gd():
    """Lazy import to avoid circular dependency with generate_data."""
    import generate_data as gd

    return gd

# Hard-variant / edge amounts (demo seed 42 DB)
H1_NEAR_DUP_A = 80_000.0
H1_NEAR_DUP_B = 80_500.0  # $500 apart
H2_RECLASS = 110_000.0
H3_VAGUE = 65_000.0
H4_TOTAL = 90_000.0
H4_EXPLAINED = 81_000.0  # 90%
H4_RESIDUAL = 9_000.0  # 10%
S1_DELTA = 4_500.0  # >10% on small base, well under $50k


def _day0(period: str) -> date:
    return date.fromisoformat(f"{period}-01")


def plant_hard_and_edge(
    balances: dict[tuple[str, str, str], float],
    periods: list[str],
) -> list:
    """Demo-only hard variants H1–H4 plus S1 (high-pct / low-dollar, not flagged)."""
    AnomalyRecord = _gd().AnomalyRecord
    records = []
    # Periods relative to as-of 2026-09
    h1 = periods[-4]  # 2026-06 — near-dup Travel ND-EU
    h2 = periods[-3]  # 2026-07 — silent reclass ND-US
    h3 = periods[-1]  # 2026-09 — vague adjustment
    h4 = periods[-2]  # 2026-08 — 90/10 partial
    s1 = periods[-5]  # 2026-05 — small Misc opex ND-EU

    # H1 — near-duplicate accrual (same vendor, amounts differ $500, different refs)
    for period in periods[periods.index(h1) :]:
        balances[(period, "ND-EU", "6300")] = round(
            balances[(period, "ND-EU", "6300")] + H1_NEAR_DUP_B, 2
        )
    records.append(
        AnomalyRecord(
            anomaly_id="H1",
            account_id="6300",
            entity="ND-EU",
            period=h1,
            amount=H1_NEAR_DUP_B,
            kind="near_duplicate_accrual",
            explanation=(
                "Near-duplicate Travel accruals: same vendor, amounts $80,000 vs "
                "$80,500, different references — not an identical duplicate."
            ),
            expected_confidence="med",
            expected_citations=("ACCR-TRAVEL-NEAR-A", "ACCR-TRAVEL-NEAR-B"),
        )
    )

    # H2 — reclass with no memo keyword
    for period in periods[periods.index(h2) :]:
        balances[(period, "ND-US", "6010")] = round(
            balances[(period, "ND-US", "6010")] - H2_RECLASS, 2
        )
        balances[(period, "ND-US", "6900")] = round(
            balances[(period, "ND-US", "6900")] + H2_RECLASS, 2
        )
    records.append(
        AnomalyRecord(
            anomaly_id="H2",
            account_id="6010",
            entity="ND-US",
            period=h2,
            amount=-H2_RECLASS,
            kind="reclass_no_memo",
            explanation=(
                "Benefits → Other Opex move of $110,000 via paired JEs with no "
                "'reclass' language in the memo."
            ),
            expected_confidence="med",
            expected_citations=("JE-MOVE-6010", "JE-MOVE-6900"),
        )
    )
    records.append(
        AnomalyRecord(
            anomaly_id="H2B",
            account_id="6900",
            entity="ND-US",
            period=h2,
            amount=H2_RECLASS,
            kind="reclass_no_memo",
            explanation="Paired side of H2 (Other Opex).",
            expected_confidence="med",
            expected_citations=("JE-MOVE-6010", "JE-MOVE-6900"),
        )
    )

    # H3 — vague manual JE ("adjustment"), no vendor
    balances[(h3, "ND-EU", "6400")] = round(
        balances[(h3, "ND-EU", "6400")] + H3_VAGUE, 2
    )
    records.append(
        AnomalyRecord(
            anomaly_id="H3",
            account_id="6400",
            entity="ND-EU",
            period=h3,
            amount=H3_VAGUE,
            kind="vague_manual_je",
            explanation=(
                "Manual JE +$65,000 with memo 'adjustment' and no vendor — not blank, "
                "so unsupported_je policy may not fire; still weak support."
            ),
            expected_confidence="low",
            expected_citations=("JE-MANUAL-ADJUST",),
        )
    )

    # H4 — partial 90% / 10%
    for period in periods[periods.index(h4) :]:
        balances[(period, "ND-US", "6700")] = round(
            balances[(period, "ND-US", "6700")] + H4_TOTAL, 2
        )
    records.append(
        AnomalyRecord(
            anomaly_id="H4",
            account_id="6700",
            entity="ND-US",
            period=h4,
            amount=H4_TOTAL,
            kind="partial_90_10",
            explanation=(
                "Depreciation / support spend +$90,000: $81,000 (90%) annual support "
                "contract renewal supported; $9,000 (10%) residual unmatched."
            ),
            expected_confidence="med",
            expected_citations=("INS-ANNUAL-2026-US", "INS-RESIDUAL-UNMATCHED"),
        )
    )

    # S1 — small account, >10% MoM, <$50k → should NOT dual-threshold flag
    for period in periods[periods.index(s1) :]:
        balances[(period, "ND-EU", "6950")] = round(
            balances[(period, "ND-EU", "6950")] + S1_DELTA, 2
        )
    records.append(
        AnomalyRecord(
            anomaly_id="S1",
            account_id="6950",
            entity="ND-EU",
            period=s1,
            amount=S1_DELTA,
            kind="small_high_pct",
            explanation=(
                "Misc operating expense MoM >10% but only +$4,500 — below dollar "
                "threshold; expected_flagged false under AND policy."
            ),
            expected_confidence="high",
            expected_citations=(),
        )
    )

    return records


def override_hard_and_edge(
    sub_rows: list[tuple],
    balances: dict[tuple[str, str, str], float],
    periods: list[str],
    seed: int,
) -> list[tuple]:
    h1 = periods[-4]
    h2 = periods[-3]
    h3 = periods[-1]
    h4 = periods[-2]
    s1 = periods[-5]

    def drop(account: str, entity: str, period: str) -> None:
        nonlocal sub_rows
        sub_rows = [
            r
            for r in sub_rows
            if not (r[3] == account and r[2] == entity and r[1] == period)
        ]

    # H1 near-dup Travel ND-EU
    for period in periods[periods.index(h1) :]:
        drop("6300", "ND-EU", period)
        day0 = _day0(period)
        tb = balances[(period, "ND-EU", "6300")]
        rem = round(tb - (H1_NEAR_DUP_A + H1_NEAR_DUP_B), 2)
        sub_rows.append(
            (
                f"ACCR-TRAVEL-NEAR-A-{period}",
                period,
                "ND-EU",
                "6300",
                (day0 + timedelta(days=20)).isoformat(),
                "V-203",
                "Travel month-end accrual REF-NEAR-A",
                H1_NEAR_DUP_A,
                "ERP",
                "accrual",
            )
        )
        sub_rows.append(
            (
                f"ACCR-TRAVEL-NEAR-B-{period}",
                period,
                "ND-EU",
                "6300",
                (day0 + timedelta(days=21)).isoformat(),
                "V-203",
                "Travel month-end accrual REF-NEAR-B",
                H1_NEAR_DUP_B,
                "ERP",
                "accrual",
            )
        )
        if abs(rem) > 0.005:
            rng = random.Random(f"{seed}:h1:{period}")
            sub_rows.extend(
                _gd().build_expense_detail_rows(
                    "6300", period, "ND-EU", rem, day0, rng
                )
            )

    # H2 silent reclass ND-US 6010 ↔ 6900
    for period in periods[periods.index(h2) :]:
        day0 = _day0(period)
        drop("6010", "ND-US", period)
        drop("6900", "ND-US", period)
        tb_a = balances[(period, "ND-US", "6010")]
        tb_b = balances[(period, "ND-US", "6900")]
        rem_a = round(tb_a - (-H2_RECLASS), 2)
        rem_b = round(tb_b - H2_RECLASS, 2)
        sub_rows.append(
            (
                f"JE-MOVE-6010-{period}",
                period,
                "ND-US",
                "6010",
                (day0 + timedelta(days=18)).isoformat(),
                None,
                "Cost center alignment per controller worksheet",
                -H2_RECLASS,
                "ERP",
                "reclass",
            )
        )
        sub_rows.append(
            (
                f"JE-MOVE-6900-{period}",
                period,
                "ND-US",
                "6900",
                (day0 + timedelta(days=18)).isoformat(),
                None,
                "Cost center alignment per controller worksheet",
                H2_RECLASS,
                "ERP",
                "reclass",
            )
        )
        if abs(rem_a) > 0.005:
            rng = random.Random(f"{seed}:h2a:{period}")
            sub_rows.extend(
                _gd().build_expense_detail_rows(
                    "6010", period, "ND-US", rem_a, day0, rng
                )
            )
        if abs(rem_b) > 0.005:
            rng = random.Random(f"{seed}:h2b:{period}")
            sub_rows.extend(
                _gd().build_expense_detail_rows(
                    "6900", period, "ND-US", rem_b, day0, rng
                )
            )

    # H3 vague adjustment ND-EU 6400
    drop("6400", "ND-EU", h3)
    day0 = _day0(h3)
    tb = balances[(h3, "ND-EU", "6400")]
    rem = round(tb - H3_VAGUE, 2)
    sub_rows.append(
        (
            "JE-MANUAL-ADJUST",
            h3,
            "ND-EU",
            "6400",
            (day0 + timedelta(days=27)).isoformat(),
            None,
            "adjustment",
            H3_VAGUE,
            "ERP",
            "manual_je",
        )
    )
    if abs(rem) > 0.005:
        rng = random.Random(f"{seed}:h3:{h3}")
        sub_rows.extend(
            _gd().build_expense_detail_rows("6400", h3, "ND-EU", rem, day0, rng)
        )

    # H4 90/10 Insurance ND-US
    for period in periods[periods.index(h4) :]:
        drop("6700", "ND-US", period)
        day0 = _day0(period)
        tb = balances[(period, "ND-US", "6700")]
        rem = round(tb - H4_TOTAL, 2)
        sub_rows.append(
            (
                f"INS-ANNUAL-2026-US-{period}",
                period,
                "ND-US",
                "6700",
                (day0 + timedelta(days=8)).isoformat(),
                "V-204",
                "Annual equipment support contract renewal 2026",
                H4_EXPLAINED,
                "ERP",
                "expense_detail",
            )
        )
        sub_rows.append(
            (
                f"INS-RESIDUAL-UNMATCHED-{period}",
                period,
                "ND-US",
                "6700",
                (day0 + timedelta(days=14)).isoformat(),
                "V-204",
                "Vendor invoice — no PO / no matching contract reference",
                H4_RESIDUAL,
                "ERP",
                "expense_detail",
            )
        )
        if abs(rem) > 0.005:
            rng = random.Random(f"{seed}:h4:{period}")
            sub_rows.extend(
                _gd().build_expense_detail_rows(
                    "6700", period, "ND-US", rem, day0, rng
                )
            )

    # S1 — keep generic expense detail reconciling to bumped TB (no special story)
    for period in periods[periods.index(s1) :]:
        drop("6950", "ND-EU", period)
        day0 = _day0(period)
        tb = balances[(period, "ND-EU", "6950")]
        rng = random.Random(f"{seed}:s1:{period}")
        sub_rows.extend(
            _gd().build_expense_detail_rows("6950", period, "ND-EU", tb, day0, rng)
        )

    return sub_rows


def plant_holdout(
    balances: dict[tuple[str, str, str], float],
    periods: list[str],
) -> list:
    """Same anomaly TYPES as A1–C1 in different accounts / entities / periods."""
    AnomalyRecord = _gd().AnomalyRecord
    # Shift periods vs demo where possible
    a1 = periods[-5]  # 2026-05
    a2 = periods[-4]  # 2026-06
    a3_rec = periods[-3]  # 2026-07
    a3_off = periods[-2]  # 2026-08
    a4 = periods[-1]  # 2026-09
    b1 = periods[-1]  # 2026-09 latest-only (avoid reverse MoM)
    b2 = periods[-8]  # 2026-02
    c1 = periods[-3]  # 2026-07

    A1_AMT = 85_000.0
    A2_AMT = 120_000.0
    A3_AMT = 400_000.0
    A4_AMT = 70_000.0
    B1_AMT = 75_000.0
    B2_AMT = 55_000.0
    C1_TOT, C1_EXP, C1_RES = 90_000.0, 60_000.0, 30_000.0

    records = []

    # A1-type: identical duplicate accrual on Facilities ND-EU (not Cloud Hosting)
    for period in periods[periods.index(a1) :]:
        balances[(period, "ND-EU", "6800")] = round(
            balances[(period, "ND-EU", "6800")] + A1_AMT, 2
        )
    records.append(
        AnomalyRecord(
            "A1",
            "6800",
            "ND-EU",
            a1,
            A1_AMT,
            "duplicate_accrual",
            "Duplicate Training & Development accrual (holdout).",
            "high",
            ("ACCR-FACIL-6800-BASE", "ACCR-FACIL-6800-DUP"),
        )
    )

    # A2-type: Salaries → Other Opex ND-US
    for period in periods[periods.index(a2) :]:
        balances[(period, "ND-US", "6000")] = round(
            balances[(period, "ND-US", "6000")] - A2_AMT, 2
        )
        balances[(period, "ND-US", "6900")] = round(
            balances[(period, "ND-US", "6900")] + A2_AMT, 2
        )
    records.append(
        AnomalyRecord(
            "A2",
            "6000",
            "ND-US",
            a2,
            -A2_AMT,
            "opex_reclass",
            "Holdout reclass Salaries → Other Opex.",
            "high",
            ("JE-RCL-HOLD-6000", "JE-RCL-HOLD-6900"),
        )
    )
    records.append(
        AnomalyRecord(
            "A2B",
            "6900",
            "ND-US",
            a2,
            A2_AMT,
            "opex_reclass",
            "Holdout paired Other Opex side.",
            "high",
            ("JE-RCL-HOLD-6000", "JE-RCL-HOLD-6900"),
        )
    )

    # A3-type: Usage Revenue ND-EU timing
    balances[(a3_rec, "ND-EU", "4100")] = round(
        balances[(a3_rec, "ND-EU", "4100")] - A3_AMT, 2
    )
    records.append(
        AnomalyRecord(
            "A3",
            "4100",
            "ND-EU",
            a3_rec,
            -A3_AMT,
            "revenue_timing",
            "Holdout premature usage revenue recognition.",
            "high",
            ("JE-HOLD-REV-FWD", "CTR-4100-NDEU"),
        )
    )
    records.append(
        AnomalyRecord(
            "A3B",
            "4100",
            "ND-EU",
            a3_off,
            A3_AMT,
            "revenue_timing_offset",
            "Holdout usage revenue offset/reversal.",
            "high",
            ("JE-HOLD-REV-REV", "CTR-4100-NDEU"),
        )
    )

    # A4-type: blank manual JE on Travel ND-US
    balances[(a4, "ND-US", "6300")] = round(
        balances[(a4, "ND-US", "6300")] + A4_AMT, 2
    )
    records.append(
        AnomalyRecord(
            "A4",
            "6300",
            "ND-US",
            a4,
            A4_AMT,
            "unexplained",
            "Holdout blank manual JE on Travel.",
            "low",
            ("JE-MANUAL-EMPTY",),
        )
    )

    # B1-type: Marketing ND-EU summit (avoid 'conference' keyword)
    balances[(b1, "ND-EU", "6200")] = round(
        balances[(b1, "ND-EU", "6200")] + B1_AMT, 2
    )
    records.append(
        AnomalyRecord(
            "B1",
            "6200",
            "ND-EU",
            b1,
            B1_AMT,
            "benign_conference",
            "Holdout annual customer summit spend.",
            "high",
            ("SUMMIT-2026-01", "SUMMIT-2026-02"),
        )
    )

    # B2-type: Recruiting ND-EU
    for period in periods[periods.index(b2) :]:
        balances[(period, "ND-EU", "6600")] = round(
            balances[(period, "ND-EU", "6600")] + B2_AMT, 2
        )
    records.append(
        AnomalyRecord(
            "B2",
            "6600",
            "ND-EU",
            b2,
            B2_AMT,
            "benign_hiring",
            "Holdout staffing-ramp agency fees.",
            "high",
            ("STAFF-RAMP-2026-Q1",),
        )
    )

    # C1-type: Software ND-US partial
    for period in periods[periods.index(c1) :]:
        balances[(period, "ND-US", "6100")] = round(
            balances[(period, "ND-US", "6100")] + C1_TOT, 2
        )
    records.append(
        AnomalyRecord(
            "C1",
            "6100",
            "ND-US",
            c1,
            C1_TOT,
            "partial_software",
            "Holdout software partial explanation 60/30.",
            "med",
            ("APP-LICENSE-2026-US", "APP-RESIDUAL-UNMATCHED"),
        )
    )

    # stash amounts for override
    plant_holdout._amounts = {  # type: ignore[attr-defined]
        "A1": A1_AMT,
        "A2": A2_AMT,
        "A3": A3_AMT,
        "A4": A4_AMT,
        "B1": B1_AMT,
        "B2": B2_AMT,
        "C1_TOT": C1_TOT,
        "C1_EXP": C1_EXP,
        "C1_RES": C1_RES,
        "periods": {
            "a1": a1,
            "a2": a2,
            "a3_rec": a3_rec,
            "a3_off": a3_off,
            "a4": a4,
            "b1": b1,
            "b2": b2,
            "c1": c1,
        },
    }
    return records


def override_holdout(
    sub_rows: list[tuple],
    balances: dict[tuple[str, str, str], float],
    periods: list[str],
    seed: int,
) -> list[tuple]:
    am = plant_holdout._amounts  # type: ignore[attr-defined]
    p = am["periods"]
    A1_AMT, A2_AMT = am["A1"], am["A2"]
    A3_AMT, A4_AMT = am["A3"], am["A4"]
    B1_AMT, B2_AMT = am["B1"], am["B2"]
    C1_TOT, C1_EXP, C1_RES = am["C1_TOT"], am["C1_EXP"], am["C1_RES"]

    def drop(account: str, entity: str, period: str) -> None:
        nonlocal sub_rows
        sub_rows = [
            r
            for r in sub_rows
            if not (r[3] == account and r[2] == entity and r[1] == period)
        ]

    # A1 Facilities ND-EU duplicate
    for period in periods[periods.index(p["a1"]) :]:
        drop("6800", "ND-EU", period)
        day0 = _day0(period)
        tb = balances[(period, "ND-EU", "6800")]
        rem = round(tb - 2 * A1_AMT, 2)
        for tag, txn in (("BASE", "ACCR-FACIL-6800-BASE"), ("DUP", "ACCR-FACIL-6800-DUP")):
            sub_rows.append(
                (
                    f"{txn}-{period}",
                    period,
                    "ND-EU",
                    "6800",
                    (day0 + timedelta(days=22)).isoformat(),
                    "V-201",
                    "ACCR-FACIL-6800 Training month-end accrual",
                    A1_AMT,
                    "ERP",
                    "accrual",
                )
            )
        if abs(rem) > 0.005:
            rng = random.Random(f"{seed}:ha1:{period}")
            sub_rows.extend(
                _gd().build_expense_detail_rows("6800", period, "ND-EU", rem, day0, rng)
            )

    # A2 reclass with 'reclass' in memo (type-faithful)
    for period in periods[periods.index(p["a2"]) :]:
        day0 = _day0(period)
        drop("6000", "ND-US", period)
        drop("6900", "ND-US", period)
        tb_a = balances[(period, "ND-US", "6000")]
        tb_b = balances[(period, "ND-US", "6900")]
        rem_a = round(tb_a - (-A2_AMT), 2)
        rem_b = round(tb_b - A2_AMT, 2)
        sub_rows.append(
            (
                f"JE-RCL-HOLD-6000-{period}",
                period,
                "ND-US",
                "6000",
                (day0 + timedelta(days=18)).isoformat(),
                None,
                "Reclass Salaries → Other Opex (holdout paired JE)",
                -A2_AMT,
                "ERP",
                "reclass",
            )
        )
        sub_rows.append(
            (
                f"JE-RCL-HOLD-6900-{period}",
                period,
                "ND-US",
                "6900",
                (day0 + timedelta(days=18)).isoformat(),
                None,
                "Reclass Salaries → Other Opex (holdout paired JE)",
                A2_AMT,
                "ERP",
                "reclass",
            )
        )
        if abs(rem_a) > 0.005:
            rng = random.Random(f"{seed}:ha2a:{period}")
            sub_rows.extend(
                _gd().build_expense_detail_rows("6000", period, "ND-US", rem_a, day0, rng)
            )
        if abs(rem_b) > 0.005:
            rng = random.Random(f"{seed}:ha2b:{period}")
            sub_rows.extend(
                _gd().build_expense_detail_rows("6900", period, "ND-US", rem_b, day0, rng)
            )

    # A3 revenue timing — IDs that do NOT start with JE-REV-TIMING
    for period, txn, amt, memo in (
        (
            p["a3_rec"],
            "JE-HOLD-REV-FWD",
            -A3_AMT,
            "CTR-4100-NDEU start next month — premature recognition",
        ),
        (
            p["a3_off"],
            "JE-HOLD-REV-REV",
            A3_AMT,
            "CTR-4100-NDEU reverse premature recognition",
        ),
    ):
        drop("4100", "ND-EU", period)
        day0 = _day0(period)
        tb = balances[(period, "ND-EU", "4100")]
        rem = round(tb - amt, 2)
        sub_rows.append(
            (
                txn,
                period,
                "ND-EU",
                "4100",
                (day0 + timedelta(days=25 if amt < 0 else 5)).isoformat(),
                "C-101",
                memo,
                amt,
                "Billing",
                "revenue_timing",
            )
        )
        if abs(rem) > 0.005:
            rng = random.Random(f"{seed}:ha3:{period}")
            sub_rows.extend(
                _gd().build_revenue_detail_rows("4100", period, "ND-EU", rem, day0, rng)
            )

    # A4 blank JE
    drop("6300", "ND-US", p["a4"])
    day0 = _day0(p["a4"])
    tb = balances[(p["a4"], "ND-US", "6300")]
    rem = round(tb - A4_AMT, 2)
    sub_rows.append(
        (
            "JE-MANUAL-EMPTY",
            p["a4"],
            "ND-US",
            "6300",
            (day0 + timedelta(days=27)).isoformat(),
            None,
            "",
            A4_AMT,
            "ERP",
            "manual_je",
        )
    )
    if abs(rem) > 0.005:
        rng = random.Random(f"{seed}:ha4")
        sub_rows.extend(
            _gd().build_expense_detail_rows("6300", p["a4"], "ND-US", rem, day0, rng)
        )

    # B1 summit (no 'conference' word)
    drop("6200", "ND-EU", p["b1"])
    day0 = _day0(p["b1"])
    tb = balances[(p["b1"], "ND-EU", "6200")]
    half = round(B1_AMT / 2, 2)
    rem = round(tb - B1_AMT, 2)
    for i, txn in enumerate(("SUMMIT-2026-01", "SUMMIT-2026-02")):
        sub_rows.append(
            (
                txn,
                p["b1"],
                "ND-EU",
                "6200",
                (day0 + timedelta(days=12 + i)).isoformat(),
                "V-205",
                "Annual customer summit — production & media (SUMMIT-2026)",
                half,
                "ERP",
                "expense_detail",
            )
        )
    if abs(rem) > 0.005:
        rng = random.Random(f"{seed}:hb1")
        sub_rows.extend(
            _gd().build_expense_detail_rows("6200", p["b1"], "ND-EU", rem, day0, rng)
        )

    # B2 staffing ramp (avoid hiring-surge tokens)
    for period in periods[periods.index(p["b2"]) :]:
        drop("6600", "ND-EU", period)
        day0 = _day0(period)
        tb = balances[(period, "ND-EU", "6600")]
        rem = round(tb - B2_AMT, 2)
        sub_rows.append(
            (
                f"STAFF-RAMP-2026-Q1-{period}",
                period,
                "ND-EU",
                "6600",
                (day0 + timedelta(days=9)).isoformat(),
                "V-206",
                "Agency placement fees — headcount ramp STAFF-RAMP-2026-Q1",
                B2_AMT,
                "ERP",
                "expense_detail",
            )
        )
        if abs(rem) > 0.005:
            rng = random.Random(f"{seed}:hb2:{period}")
            sub_rows.extend(
                _gd().build_expense_detail_rows("6600", period, "ND-EU", rem, day0, rng)
            )

    # C1 partial app license ND-US
    for period in periods[periods.index(p["c1"]) :]:
        drop("6100", "ND-US", period)
        day0 = _day0(period)
        tb = balances[(period, "ND-US", "6100")]
        rem = round(tb - C1_TOT, 2)
        sub_rows.append(
            (
                f"APP-LICENSE-2026-US-{period}",
                period,
                "ND-US",
                "6100",
                (day0 + timedelta(days=8)).isoformat(),
                "V-207",
                "Annual application license renewal — APP-LICENSE-2026-US",
                C1_EXP,
                "ERP",
                "expense_detail",
            )
        )
        sub_rows.append(
            (
                f"APP-RESIDUAL-UNMATCHED-{period}",
                period,
                "ND-US",
                "6100",
                (day0 + timedelta(days=15)).isoformat(),
                "V-207",
                "Vendor invoice — no PO / no matching contract reference",
                C1_RES,
                "ERP",
                "expense_detail",
            )
        )
        if abs(rem) > 0.005:
            rng = random.Random(f"{seed}:hc1:{period}")
            sub_rows.extend(
                _gd().build_expense_detail_rows("6100", period, "ND-US", rem, day0, rng)
            )

    return sub_rows
