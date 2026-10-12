#!/usr/bin/env python3
"""Generate synthetic finance data for Northwind Digital (SQLite).

Company: Northwind Digital
Entities: ND-US, ND-EU
Planted anomalies A1–A4, B1–B2, and C1 (see data/ANOMALIES.md).
All figures are synthetic. source_system labels are generic only.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sqlite3
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "finance.db"
HOLDOUT_DB_PATH = ROOT / "data" / "finance_holdout.db"
EXPORT_DIR = ROOT / "exports"
DEFAULT_SEED = 42
HOLDOUT_SEED = 43
SEED = DEFAULT_SEED  # mutated by generate() for deterministic sub-seeds
COMPANY = "Northwind Digital"
ENTITIES = ["ND-US", "ND-EU"]

# ~40-account chart of accounts (id, name, type, statement)
ACCOUNTS: list[tuple[str, str, str, str]] = [
    # Assets
    ("1000", "Cash", "Asset", "BS"),
    ("1100", "Accounts Receivable", "Asset", "BS"),
    ("1200", "Prepaid Expenses", "Asset", "BS"),
    ("1300", "Other Current Assets", "Asset", "BS"),
    ("1400", "Property Plant & Equipment", "Asset", "BS"),
    ("1500", "Accumulated Depreciation", "Asset", "BS"),  # contra (credit)
    ("1600", "Intangible Assets", "Asset", "BS"),
    # Liabilities
    ("2000", "Accounts Payable", "Liability", "BS"),
    ("2100", "Accrued Expenses", "Liability", "BS"),
    ("2200", "Accrued Payroll", "Liability", "BS"),
    ("2300", "Deferred Revenue", "Liability", "BS"),
    ("2400", "Short-term Debt", "Liability", "BS"),
    ("2500", "Long-term Debt", "Liability", "BS"),
    # Equity
    ("3000", "Common Stock", "Equity", "BS"),
    ("3100", "Additional Paid-in Capital", "Equity", "BS"),
    ("3200", "Retained Earnings", "Equity", "BS"),
    # Revenue
    ("4000", "Subscription Revenue", "Revenue", "PL"),
    ("4100", "Usage Revenue", "Revenue", "PL"),
    ("4200", "Services Revenue", "Revenue", "PL"),
    ("4300", "Other Revenue", "Revenue", "PL"),
    # COGS
    ("5000", "Cost of Subscription", "Expense", "PL"),
    ("5100", "Cost of Usage", "Expense", "PL"),
    ("5200", "Cost of Services Delivery", "Expense", "PL"),
    # Opex (12+)
    ("6000", "Salaries & Wages", "Expense", "PL"),
    ("6010", "Employee Benefits", "Expense", "PL"),
    ("6020", "Contractors", "Expense", "PL"),
    ("6100", "Software Subscriptions", "Expense", "PL"),
    ("6110", "Cloud Hosting", "Expense", "PL"),
    ("6200", "Marketing & Advertising", "Expense", "PL"),
    ("6300", "Travel", "Expense", "PL"),
    ("6310", "Meals & Entertainment", "Expense", "PL"),
    ("6400", "Rent & Facilities", "Expense", "PL"),
    ("6500", "Professional Fees", "Expense", "PL"),
    ("6600", "Recruiting", "Expense", "PL"),
    ("6700", "Depreciation Expense", "Expense", "PL"),
    ("6800", "Training & Development", "Expense", "PL"),
    ("6900", "Office Supplies", "Expense", "PL"),
    ("6950", "Insurance", "Expense", "PL"),
    ("7000", "Bad Debt Expense", "Expense", "PL"),
    ("7100", "Bank Fees", "Expense", "PL"),
]

# Base monthly magnitude by account (signed: credit-normal negative for liability/equity/revenue)
BASE_MONTHLY: dict[str, float] = {
    "1000": 4_200_000,
    "1100": 2_100_000,
    "1200": 380_000,
    "1300": 210_000,
    "1400": 3_400_000,
    "1500": -980_000,
    "1600": 720_000,
    "2000": -890_000,
    "2100": -420_000,
    "2200": -310_000,
    "2300": -1_150_000,
    "2400": -250_000,
    "2500": -1_800_000,
    "3000": -100_000,
    "3100": -4_500_000,
    "3200": -2_200_000,
    # P&L monthly activity
    "4000": -1_850_000,
    "4100": -620_000,
    "4200": -410_000,
    "4300": -55_000,
    "5000": 420_000,
    "5100": 180_000,
    "5200": 145_000,
    "6000": 980_000,
    "6010": 210_000,
    "6020": 160_000,
    "6100": 95_000,
    "6110": 175_000,
    "6200": 240_000,
    "6300": 48_000,
    "6310": 22_000,
    "6400": 130_000,
    "6500": 85_000,
    "6600": 40_000,
    "6700": 75_000,
    "6800": 18_000,
    "6900": 12_000,
    "6950": 35_000,
    "7000": 15_000,
    "7100": 8_000,
}

ENTITY_SCALE = {"ND-US": 1.0, "ND-EU": 0.58}

CUSTOMERS = [
    ("C-100", "Cedar Analytics", "US"),
    ("C-101", "Helios Retail Group", "US"),
    ("C-102", "Atlas Manufacturing", "DE"),
    ("C-103", "Blue Harbor Logistics", "UK"),
    ("C-104", "Cascade Health Systems", "US"),
    ("C-105", "Meridian Media Co", "FR"),
    ("C-106", "Pioneer Freight Lines", "NL"),
]

VENDORS = [
    ("V-200", "Nimbus Hosting Co", "US"),
    ("V-201", "Summit Legal Partners", "US"),
    ("V-202", "Harbor Facilities LLC", "US"),
    ("V-203", "Orbit Travel Desk", "IE"),
    ("V-204", "Prime Temp Staffing", "US"),
    ("V-205", "Brightline Marketing", "US"),
    ("V-206", "Cobalt Recruiting", "UK"),
    ("V-207", "Parcel Softwares Ltd", "DE"),
]

# Accounts with detailed subledgers that must reconcile to TB
AR_ACCOUNT = "1100"
AP_ACCOUNT = "2000"
ACCRUAL_ACCOUNTS = {"2100", "2200"}
OPEX_DETAIL_ACCOUNTS = {
    "6000",
    "6010",
    "6020",
    "6100",
    "6110",
    "6200",
    "6300",
    "6310",
    "6400",
    "6500",
    "6600",
    "6700",
    "6800",
    "6900",
    "6950",
    "7000",
    "7100",
    "5000",
    "5100",
    "5200",
}
REVENUE_DETAIL_ACCOUNTS = {"4000", "4100", "4200", "4300"}

# Anomaly amounts (deterministic)
A1_DUP_AMOUNT = 85_000.0  # duplicate accrual size (= full TB variance vs baseline)
A2_RECLASS_AMOUNT = 120_000.0
A3_REV_AMOUNT = 400_000.0
A4_UNEXPLAINED_AMOUNT = 70_000.0
B1_CONFERENCE_AMOUNT = 75_000.0
B2_RECRUITING_AMOUNT = 55_000.0
C1_SOFTWARE_TOTAL = 90_000.0
C1_SOFTWARE_EXPLAINED = 60_000.0
C1_SOFTWARE_RESIDUAL = 30_000.0


@dataclass(frozen=True)
class AnomalyRecord:
    anomaly_id: str
    account_id: str
    entity: str
    period: str
    amount: float
    kind: str
    explanation: str
    expected_confidence: str
    expected_citations: tuple[str, ...]


def month_starts(n: int = 24, end: date | None = None) -> list[date]:
    end = end or date(2026, 9, 1)
    year, month = end.year, end.month
    out: list[date] = []
    for _ in range(n):
        out.append(date(year, month, 1))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    return list(reversed(out))


def period_label(d: date) -> str:
    return d.strftime("%Y-%m")


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        DROP TABLE IF EXISTS tool_call_log;
        DROP TABLE IF EXISTS review_queue;
        DROP TABLE IF EXISTS close_tasks;
        DROP TABLE IF EXISTS subledger;
        DROP TABLE IF EXISTS trial_balance;
        DROP TABLE IF EXISTS accounts;
        DROP TABLE IF EXISTS parties;
        DROP TABLE IF EXISTS anomalies;
        DROP TABLE IF EXISTS meta;

        CREATE TABLE meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE accounts (
            account_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            account_type TEXT NOT NULL,
            statement TEXT NOT NULL
        );

        CREATE TABLE parties (
            party_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            party_type TEXT NOT NULL,
            country TEXT NOT NULL
        );

        CREATE TABLE trial_balance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            period TEXT NOT NULL,
            entity TEXT NOT NULL,
            account_id TEXT NOT NULL,
            ending_balance REAL NOT NULL,
            UNIQUE(period, entity, account_id)
        );

        CREATE TABLE subledger (
            txn_id TEXT PRIMARY KEY,
            period TEXT NOT NULL,
            entity TEXT NOT NULL,
            account_id TEXT NOT NULL,
            txn_date TEXT NOT NULL,
            party_id TEXT,
            memo TEXT NOT NULL,
            amount REAL NOT NULL,
            source_system TEXT NOT NULL,
            entry_type TEXT NOT NULL
        );

        CREATE TABLE close_tasks (
            task_id TEXT PRIMARY KEY,
            period TEXT NOT NULL,
            entity TEXT NOT NULL,
            title TEXT NOT NULL,
            owner TEXT NOT NULL,
            status TEXT NOT NULL,
            due_day INTEGER NOT NULL
        );

        CREATE TABLE anomalies (
            anomaly_id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            entity TEXT NOT NULL,
            period TEXT NOT NULL,
            amount REAL NOT NULL,
            kind TEXT NOT NULL,
            explanation TEXT NOT NULL,
            expected_confidence TEXT NOT NULL,
            expected_citations TEXT NOT NULL
        );

        CREATE TABLE review_queue (
            item_id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            period TEXT NOT NULL,
            entity TEXT NOT NULL,
            variance_pct REAL NOT NULL,
            variance_amt REAL NOT NULL,
            draft_commentary TEXT NOT NULL,
            confidence TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            edited_commentary TEXT,
            reviewer_note TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE tool_call_log (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            tool_name TEXT NOT NULL,
            arguments TEXT NOT NULL,
            result_summary TEXT NOT NULL
        );
        """
    )


def seasonality_factor(account_id: str, month: int) -> float:
    """Mild seasonality so MoM stays mostly under threshold."""
    # month: 1-12
    angle = 2 * math.pi * (month - 1) / 12
    if account_id.startswith("4"):  # revenue: mild Q4 lift
        return 1.0 + 0.04 * math.sin(angle - 0.5) + (0.03 if month in (11, 12) else 0.0)
    if account_id in {"6200", "6300", "6310", "6600"}:  # marketing / travel / recruiting
        return 1.0 + 0.045 * math.sin(angle + 0.8)
    if account_id.startswith("5") or account_id.startswith("6") or account_id.startswith("7"):
        return 1.0 + 0.025 * math.sin(angle)
    if account_id == "1100":
        return 1.0 + 0.02 * math.sin(angle - 0.2)
    return 1.0 + 0.015 * math.sin(angle)


def balance_for(
    account_id: str,
    entity: str,
    month_idx: int,
    month_num: int,
    rng: random.Random,
) -> float:
    """Deterministic ending balance / monthly activity with growth + mild seasonality."""
    base = BASE_MONTHLY[account_id] * ENTITY_SCALE[entity]
    growth = 1.0 + month_idx * 0.0075  # ~0.75%/month
    seasonal = seasonality_factor(account_id, month_num)
    # Tiny deterministic noise (±1.2%) — keeps MoM under dual threshold
    noise = 1.0 + rng.uniform(-0.012, 0.012)
    return round(base * growth * seasonal * noise, 2)


def split_amount(total: float, n: int, rng: random.Random) -> list[float]:
    """Split total into n parts that sum exactly to total."""
    if n <= 0:
        return []
    if n == 1:
        return [round(total, 2)]
    weights = [rng.uniform(0.7, 1.3) for _ in range(n)]
    s = sum(weights)
    parts = [total * (w / s) for w in weights]
    parts = [round(p, 2) for p in parts]
    drift = round(total - sum(parts), 2)
    parts[-1] = round(parts[-1] + drift, 2)
    return parts


def build_ar_rows(
    period: str,
    entity: str,
    target: float,
    day0: date,
    rng: random.Random,
) -> list[tuple]:
    """Open AR as of period end: invoices + payments netting to TB AR balance."""
    rows: list[tuple] = []
    n_inv = 5 if entity == "ND-US" else 4
    # Payments as ~25% of gross invoices so invoices are larger than target
    payment_ratio = 0.25
    gross = target / (1.0 - payment_ratio) if abs(1.0 - payment_ratio) > 1e-9 else target
    inv_amts = split_amount(gross, n_inv, rng)
    pay_total = round(gross - target, 2)
    n_pay = max(1, n_inv // 2)
    pay_amts = split_amount(pay_total, n_pay, rng)

    for i, amt in enumerate(inv_amts):
        cust = CUSTOMERS[(hash((period, entity, i)) & 0xFFFF) % len(CUSTOMERS)]
        txn_id = f"AR-INV-{entity}-{period}-{i+1:03d}"
        rows.append(
            (
                txn_id,
                period,
                entity,
                AR_ACCOUNT,
                (day0 + timedelta(days=2 + i * 3)).isoformat(),
                cust[0],
                f"Invoice {cust[1]} — subscription / usage",
                round(amt, 2),
                "Billing",
                "ar_invoice",
            )
        )
    for i, amt in enumerate(pay_amts):
        cust = CUSTOMERS[(hash((period, entity, "pay", i)) & 0xFFFF) % len(CUSTOMERS)]
        txn_id = f"AR-PAY-{entity}-{period}-{i+1:03d}"
        rows.append(
            (
                txn_id,
                period,
                entity,
                AR_ACCOUNT,
                (day0 + timedelta(days=10 + i * 4)).isoformat(),
                cust[0],
                f"Payment from {cust[1]}",
                round(-amt, 2),
                "Billing",
                "ar_payment",
            )
        )
    return rows


def build_ap_rows(
    period: str,
    entity: str,
    target: float,
    day0: date,
    rng: random.Random,
) -> list[tuple]:
    """AP open items (credit-normal negative target) reconciling to TB."""
    rows: list[tuple] = []
    n = 4 if entity == "ND-US" else 3
    # target is negative; split into negative bill amounts
    amts = split_amount(target, n, rng)
    for i, amt in enumerate(amts):
        vend = VENDORS[(hash((period, entity, i)) & 0xFFFF) % len(VENDORS)]
        rows.append(
            (
                f"AP-BILL-{entity}-{period}-{i+1:03d}",
                period,
                entity,
                AP_ACCOUNT,
                (day0 + timedelta(days=3 + i * 5)).isoformat(),
                vend[0],
                f"Vendor bill — {vend[1]}",
                round(amt, 2),
                "ERP",
                "ap_bill",
            )
        )
    return rows


def build_accrual_rows(
    account_id: str,
    period: str,
    entity: str,
    target: float,
    day0: date,
    rng: random.Random,
) -> list[tuple]:
    rows: list[tuple] = []
    n = 3
    amts = split_amount(target, n, rng)
    label = "payroll" if account_id == "2200" else "operating"
    source = "HRIS" if account_id == "2200" else "ERP"
    for i, amt in enumerate(amts):
        vend = VENDORS[(hash((account_id, period, entity, i)) & 0xFFFF) % len(VENDORS)]
        rows.append(
            (
                f"ACCR-{account_id}-{entity}-{period}-{i+1:03d}",
                period,
                entity,
                account_id,
                (day0 + timedelta(days=20 + i)).isoformat(),
                vend[0] if account_id != "2200" else None,
                f"Month-end {label} accrual",
                round(amt, 2),
                source,
                "accrual",
            )
        )
    return rows


def build_expense_detail_rows(
    account_id: str,
    period: str,
    entity: str,
    target: float,
    day0: date,
    rng: random.Random,
) -> list[tuple]:
    """P&L expense detail summing to monthly TB activity."""
    rows: list[tuple] = []
    n = 3 if abs(target) > 40_000 else 2
    amts = split_amount(target, n, rng)
    name = next(a[1] for a in ACCOUNTS if a[0] == account_id)
    for i, amt in enumerate(amts):
        vend = VENDORS[(hash((account_id, period, entity, i)) & 0xFFFF) % len(VENDORS)]
        if account_id in {"6000", "6010", "6020", "6600"}:
            source = "HRIS"
            party = None if account_id in {"6000", "6010"} else vend[0]
        elif account_id in {"6300", "6310"}:
            source = "Expense Tool"
            party = vend[0]
        else:
            source = "ERP"
            party = vend[0]
        rows.append(
            (
                f"EXP-{account_id}-{entity}-{period}-{i+1:03d}",
                period,
                entity,
                account_id,
                (day0 + timedelta(days=4 + i * 6)).isoformat(),
                party,
                f"{name} — period activity",
                round(amt, 2),
                source,
                "expense_detail",
            )
        )
    return rows


def build_revenue_detail_rows(
    account_id: str,
    period: str,
    entity: str,
    target: float,
    day0: date,
    rng: random.Random,
) -> list[tuple]:
    """P&L revenue detail (credit-normal negative) summing to TB activity."""
    rows: list[tuple] = []
    n = 3 if abs(target) > 80_000 else 2
    amts = split_amount(target, n, rng)
    name = next(a[1] for a in ACCOUNTS if a[0] == account_id)
    for i, amt in enumerate(amts):
        cust = CUSTOMERS[(hash((account_id, period, entity, i)) & 0xFFFF) % len(CUSTOMERS)]
        rows.append(
            (
                f"REV-{account_id}-{entity}-{period}-{i+1:03d}",
                period,
                entity,
                account_id,
                (day0 + timedelta(days=5 + i * 5)).isoformat(),
                cust[0],
                f"{name} — recognized billing",
                round(amt, 2),
                "Billing",
                "revenue_detail",
            )
        )
    return rows


def anomaly_periods(periods: list[str]) -> dict[str, str]:
    """Map anomaly anchors from the 24-month series (latest = periods[-1])."""
    return {
        "latest": periods[-1],  # 2026-09
        "a1": periods[-4],  # 2026-06 — 3 months before latest
        "a2": periods[-3],  # 2026-07 — 2 months before latest
        "a3_recognize": periods[-4],  # 2026-06 quarter-end
        "a3_offset": periods[-3],  # 2026-07 following month
        "a4": periods[-1],
        "b1": periods[-1],
        "b2_start": periods[-7],  # 2026-03 hiring-heavy month
        "c1": periods[-2],  # 2026-08 — Software partial explanation
    }


def plant_anomalies(
    balances: dict[tuple[str, str, str], float],
    periods: list[str],
) -> list[AnomalyRecord]:
    """Mutate TB balances and return anomaly metadata for the anomalies table."""
    p = anomaly_periods(periods)
    records: list[AnomalyRecord] = []

    # A1 — duplicate Cloud Hosting accrual (sticky from a1 period onward).
    # Baseline already includes one $85k run-rate accrual in the subledger; TB only
    # increases by the duplicate (+$85k vs clean baseline).
    for period in periods[periods.index(p["a1"]) :]:
        key = (period, "ND-US", "6110")
        balances[key] = round(balances[key] + A1_DUP_AMOUNT, 2)
    records.append(
        AnomalyRecord(
            anomaly_id="A1",
            account_id="6110",
            entity="ND-US",
            period=p["a1"],
            amount=A1_DUP_AMOUNT,
            kind="duplicate_accrual",
            explanation=(
                "Duplicate Cloud Hosting accrual: baseline run-rate accrual "
                "ACCR-CLOUD-6110-BASE ($85,000) plus identical duplicate "
                "ACCR-CLOUD-6110-DUP ($85,000) for the same vendor/reference. "
                "The duplicate accounts for the full +$85,000 variance vs baseline; "
                "reverse ACCR-CLOUD-6110-DUP."
            ),
            expected_confidence="high",
            expected_citations=(
                "ACCR-CLOUD-6110-BASE",
                "ACCR-CLOUD-6110-DUP",
                "V-200",
            ),
        )
    )

    # A2 — opex reclass Contractors → Professional Fees (sticky from a2)
    for period in periods[periods.index(p["a2"]) :]:
        balances[(period, "ND-EU", "6020")] = round(
            balances[(period, "ND-EU", "6020")] - A2_RECLASS_AMOUNT, 2
        )
        balances[(period, "ND-EU", "6500")] = round(
            balances[(period, "ND-EU", "6500")] + A2_RECLASS_AMOUNT, 2
        )
    records.append(
        AnomalyRecord(
            anomaly_id="A2",
            account_id="6020",
            entity="ND-EU",
            period=p["a2"],
            amount=-A2_RECLASS_AMOUNT,
            kind="opex_reclass",
            explanation=(
                "Opex reclass of $120,000 from Contractors (6020) to Professional Fees "
                "(6500) in ND-EU via paired JEs JE-RCL-6020 and JE-RCL-6500. "
                "Net zero to total opex; classification only."
            ),
            expected_confidence="high",
            expected_citations=("JE-RCL-6020", "JE-RCL-6500", "6020", "6500"),
        )
    )
    # Paired side documented as A2B for DB query convenience (same mechanism)
    records.append(
        AnomalyRecord(
            anomaly_id="A2B",
            account_id="6500",
            entity="ND-EU",
            period=p["a2"],
            amount=A2_RECLASS_AMOUNT,
            kind="opex_reclass",
            explanation=(
                "Paired side of A2: Professional Fees increased $120,000 from Contractors "
                "reclass JE-RCL-6500 / JE-RCL-6020 in ND-EU."
            ),
            expected_confidence="high",
            expected_citations=("JE-RCL-6020", "JE-RCL-6500"),
        )
    )

    # A3 — revenue timing across quarter boundary
    # Recognize extra revenue in quarter-end month only. Following month stays on the
    # clean TB path but carries an explicit reversing JE in the subledger so Jul→Aug
    # does not create an extra threshold breach.
    balances[(p["a3_recognize"], "ND-US", "4000")] = round(
        balances[(p["a3_recognize"], "ND-US", "4000")] - A3_REV_AMOUNT, 2
    )
    records.append(
        AnomalyRecord(
            anomaly_id="A3",
            account_id="4000",
            entity="ND-US",
            period=p["a3_recognize"],
            amount=-A3_REV_AMOUNT,
            kind="revenue_timing",
            explanation=(
                "Subscription Revenue pulled forward $400,000 at quarter-end even though "
                "contract CTR-4000-NDUS start date is 2026-07-01 (next quarter). "
                "Offsetting reversal posts the following month."
            ),
            expected_confidence="high",
            expected_citations=("JE-REV-TIMING-FWD", "CTR-4000-NDUS", "2026-07-01"),
        )
    )
    records.append(
        AnomalyRecord(
            anomaly_id="A3B",
            account_id="4000",
            entity="ND-US",
            period=p["a3_offset"],
            amount=A3_REV_AMOUNT,
            kind="revenue_timing_offset",
            explanation=(
                "Offset side of A3: $400,000 Subscription Revenue reversal JE in the "
                "month after premature quarter-end recognition (JE-REV-TIMING-REV). "
                "TB returns to the normal monthly path."
            ),
            expected_confidence="high",
            expected_citations=("JE-REV-TIMING-REV", "CTR-4000-NDUS"),
        )
    )

    # A4 — unexplained T&E (Meals & Entertainment) manual JE
    balances[(p["a4"], "ND-US", "6310")] = round(
        balances[(p["a4"], "ND-US", "6310")] + A4_UNEXPLAINED_AMOUNT, 2
    )
    records.append(
        AnomalyRecord(
            anomaly_id="A4",
            account_id="6310",
            entity="ND-US",
            period=p["a4"],
            amount=A4_UNEXPLAINED_AMOUNT,
            kind="unexplained",
            explanation=(
                "Unexplained +$70,000 on Meals & Entertainment (T&E) via manual JE "
                "JE-MANUAL-BLANK with blank description, no vendor, and no supporting "
                "detail. Agent must assign low confidence and send to human review."
            ),
            expected_confidence="low",
            expected_citations=("JE-MANUAL-BLANK",),
        )
    )

    # B1 — benign Marketing conference (latest month only)
    balances[(p["b1"], "ND-US", "6200")] = round(
        balances[(p["b1"], "ND-US", "6200")] + B1_CONFERENCE_AMOUNT, 2
    )
    records.append(
        AnomalyRecord(
            anomaly_id="B1",
            account_id="6200",
            entity="ND-US",
            period=p["b1"],
            amount=B1_CONFERENCE_AMOUNT,
            kind="benign_conference",
            explanation=(
                "Benign threshold breach: annual customer conference spend $75,000 "
                "fully supported by labeled vendor invoices from Brightline Marketing "
                "(CONF-2026-ANNUAL)."
            ),
            expected_confidence="high",
            expected_citations=("CONF-2026-ANNUAL", "V-205"),
        )
    )

    # B2 — benign Recruiting surge (sticky from hiring-heavy month)
    for period in periods[periods.index(p["b2_start"]) :]:
        balances[(period, "ND-US", "6600")] = round(
            balances[(period, "ND-US", "6600")] + B2_RECRUITING_AMOUNT, 2
        )
    records.append(
        AnomalyRecord(
            anomaly_id="B2",
            account_id="6600",
            entity="ND-US",
            period=p["b2_start"],
            amount=B2_RECRUITING_AMOUNT,
            kind="benign_hiring",
            explanation=(
                "Benign threshold breach: hiring-heavy month recruiting fees +$55,000 "
                "fully explained by Cobalt Recruiting invoices labeled "
                "HIRING-SURGE-2026-Q1."
            ),
            expected_confidence="high",
            expected_citations=("HIRING-SURGE-2026-Q1", "V-206"),
        )
    )

    # C1 — partially explained Software (6100) spend in ND-EU (sticky from Aug)
    for period in periods[periods.index(p["c1"]) :]:
        balances[(period, "ND-EU", "6100")] = round(
            balances[(period, "ND-EU", "6100")] + C1_SOFTWARE_TOTAL, 2
        )
    records.append(
        AnomalyRecord(
            anomaly_id="C1",
            account_id="6100",
            entity="ND-EU",
            period=p["c1"],
            amount=C1_SOFTWARE_TOTAL,
            kind="partial_software",
            explanation=(
                "Software Subscriptions ND-EU +~$90,000: $60,000 explained by annual "
                "license renewal SW-LICENSE-2026-EU; ~$30,000 residual invoice from a "
                "real vendor lacks PO/contract match — partial explanation (med)."
            ),
            expected_confidence="med",
            expected_citations=("SW-LICENSE-2026-EU", "SW-RESIDUAL-UNMATCHED"),
        )
    )

    return records


def _day0(period: str) -> date:
    return date.fromisoformat(f"{period}-01")


def override_subledger_for_anomalies(
    sub_rows: list[tuple],
    balances: dict[tuple[str, str, str], float],
    periods: list[str],
) -> list[tuple]:
    """Replace subledger rows for anomaly keys with crafted, reconciling detail."""
    p = anomaly_periods(periods)

    def drop(account: str, entity: str, period: str) -> None:
        nonlocal sub_rows
        sub_rows = [
            r
            for r in sub_rows
            if not (r[3] == account and r[2] == entity and r[1] == period)
        ]

    # --- A1: baseline run-rate accrual + identical duplicate; TB only +$85k ---
    for period in periods[periods.index(p["a1"]) :]:
        drop("6110", "ND-US", period)
        tb = balances[(period, "ND-US", "6110")]
        # BASE is part of run rate; DUP is the +$85k variance vs clean baseline
        remainder = round(tb - 2 * A1_DUP_AMOUNT, 2)
        day0 = _day0(period)
        for suffix, txn_id in (
            ("BASE", "ACCR-CLOUD-6110-BASE"),
            ("DUP", "ACCR-CLOUD-6110-DUP"),
        ):
            sub_rows.append(
                (
                    f"{txn_id}-{period}",
                    period,
                    "ND-US",
                    "6110",
                    (day0 + timedelta(days=22)).isoformat(),
                    "V-200",
                    "ACCR-CLOUD-6110 Cloud Hosting month-end accrual",
                    A1_DUP_AMOUNT,
                    "ERP",
                    "accrual",
                )
            )
        if abs(remainder) > 0.005:
            rng = random.Random(f"{SEED}:a1rem:{period}")
            sub_rows.extend(
                build_expense_detail_rows("6110", period, "ND-US", remainder, day0, rng)
            )

    # --- A2: reclass months from a2 onward ---
    for period in periods[periods.index(p["a2"]) :]:
        day0 = _day0(period)
        # Contractors
        drop("6020", "ND-EU", period)
        tb_c = balances[(period, "ND-EU", "6020")]
        # Include explicit reclass JE (-120k) plus remainder activity
        rem_c = round(tb_c - (-A2_RECLASS_AMOUNT), 2)
        # Wait: TB already has -120k baked in. Subledger must sum to TB.
        # Put reclass JE as -120k and remainder = TB - (-120k) = TB + 120k
        rem_c = round(tb_c - (-A2_RECLASS_AMOUNT), 2)
        sub_rows.append(
            (
                f"JE-RCL-6020-{period}",
                period,
                "ND-EU",
                "6020",
                (day0 + timedelta(days=18)).isoformat(),
                "V-204",
                "Reclass Contractors → Professional Fees (A2 paired JE)",
                -A2_RECLASS_AMOUNT,
                "ERP",
                "reclass",
            )
        )
        if abs(rem_c) > 0.005:
            rng = random.Random(f"{SEED}:a2c:{period}")
            sub_rows.extend(
                build_expense_detail_rows("6020", period, "ND-EU", rem_c, day0, rng)
            )

        # Professional Fees
        drop("6500", "ND-EU", period)
        tb_p = balances[(period, "ND-EU", "6500")]
        rem_p = round(tb_p - A2_RECLASS_AMOUNT, 2)
        sub_rows.append(
            (
                f"JE-RCL-6500-{period}",
                period,
                "ND-EU",
                "6500",
                (day0 + timedelta(days=18)).isoformat(),
                "V-201",
                "Reclass Contractors → Professional Fees (A2 paired JE)",
                A2_RECLASS_AMOUNT,
                "ERP",
                "reclass",
            )
        )
        if abs(rem_p) > 0.005:
            rng = random.Random(f"{SEED}:a2p:{period}")
            sub_rows.extend(
                build_expense_detail_rows("6500", period, "ND-EU", rem_p, day0, rng)
            )

    # --- A3 recognize month ---
    period = p["a3_recognize"]
    drop("4000", "ND-US", period)
    day0 = _day0(period)
    tb = balances[(period, "ND-US", "4000")]
    # Extra revenue -400k (credit); remainder = TB - (-400k)
    rem = round(tb - (-A3_REV_AMOUNT), 2)
    sub_rows.append(
        (
            "JE-REV-TIMING-FWD",
            period,
            "ND-US",
            "4000",
            (day0 + timedelta(days=25)).isoformat(),
            "C-100",
            "CTR-4000-NDUS start 2026-07-01 — premature quarter-end recognition",
            -A3_REV_AMOUNT,
            "Billing",
            "revenue_timing",
        )
    )
    if abs(rem) > 0.005:
        rng = random.Random(f"{SEED}:a3f:{period}")
        sub_rows.extend(
            build_revenue_detail_rows("4000", period, "ND-US", rem, day0, rng)
        )

    # --- A3 offset month ---
    period = p["a3_offset"]
    drop("4000", "ND-US", period)
    day0 = _day0(period)
    tb = balances[(period, "ND-US", "4000")]
    rem = round(tb - A3_REV_AMOUNT, 2)
    sub_rows.append(
        (
            "JE-REV-TIMING-REV",
            period,
            "ND-US",
            "4000",
            (day0 + timedelta(days=5)).isoformat(),
            "C-100",
            "CTR-4000-NDUS reverse premature recognition — contract starts this quarter",
            A3_REV_AMOUNT,
            "Billing",
            "revenue_timing",
        )
    )
    if abs(rem) > 0.005:
        rng = random.Random(f"{SEED}:a3r:{period}")
        sub_rows.extend(
            build_revenue_detail_rows("4000", period, "ND-US", rem, day0, rng)
        )

    # --- A4 unexplained ---
    period = p["a4"]
    drop("6310", "ND-US", period)
    day0 = _day0(period)
    tb = balances[(period, "ND-US", "6310")]
    rem = round(tb - A4_UNEXPLAINED_AMOUNT, 2)
    sub_rows.append(
        (
            "JE-MANUAL-BLANK",
            period,
            "ND-US",
            "6310",
            (day0 + timedelta(days=27)).isoformat(),
            None,
            "",  # blank description
            A4_UNEXPLAINED_AMOUNT,
            "ERP",
            "manual_je",
        )
    )
    if abs(rem) > 0.005:
        rng = random.Random(f"{SEED}:a4:{period}")
        sub_rows.extend(
            build_expense_detail_rows("6310", period, "ND-US", rem, day0, rng)
        )

    # --- B1 conference (latest only) ---
    period = p["b1"]
    drop("6200", "ND-US", period)
    day0 = _day0(period)
    tb = balances[(period, "ND-US", "6200")]
    rem = round(tb - B1_CONFERENCE_AMOUNT, 2)
    # Split conference across two clearly labeled invoices
    half = round(B1_CONFERENCE_AMOUNT / 2, 2)
    other = round(B1_CONFERENCE_AMOUNT - half, 2)
    sub_rows.append(
        (
            "CONF-2026-ANNUAL-01",
            period,
            "ND-US",
            "6200",
            (day0 + timedelta(days=12)).isoformat(),
            "V-205",
            "Annual customer conference — venue & production (CONF-2026-ANNUAL)",
            half,
            "ERP",
            "expense_detail",
        )
    )
    sub_rows.append(
        (
            "CONF-2026-ANNUAL-02",
            period,
            "ND-US",
            "6200",
            (day0 + timedelta(days=13)).isoformat(),
            "V-205",
            "Annual customer conference — media buy (CONF-2026-ANNUAL)",
            other,
            "ERP",
            "expense_detail",
        )
    )
    if abs(rem) > 0.005:
        rng = random.Random(f"{SEED}:b1:{period}")
        sub_rows.extend(
            build_expense_detail_rows("6200", period, "ND-US", rem, day0, rng)
        )

    # --- B2 recruiting sticky ---
    for period in periods[periods.index(p["b2_start"]) :]:
        drop("6600", "ND-US", period)
        day0 = _day0(period)
        tb = balances[(period, "ND-US", "6600")]
        rem = round(tb - B2_RECRUITING_AMOUNT, 2)
        sub_rows.append(
            (
                f"HIRING-SURGE-2026-Q1-{period}",
                period,
                "ND-US",
                "6600",
                (day0 + timedelta(days=9)).isoformat(),
                "V-206",
                "Hiring surge recruiting fees — HIRING-SURGE-2026-Q1",
                B2_RECRUITING_AMOUNT,
                "HRIS",
                "expense_detail",
            )
        )
        if abs(rem) > 0.005:
            rng = random.Random(f"{SEED}:b2:{period}")
            sub_rows.extend(
                build_expense_detail_rows("6600", period, "ND-US", rem, day0, rng)
            )

    # --- C1 Software partial explanation (ND-EU, sticky from Aug) ---
    for period in periods[periods.index(p["c1"]) :]:
        drop("6100", "ND-EU", period)
        day0 = _day0(period)
        tb = balances[(period, "ND-EU", "6100")]
        rem = round(tb - C1_SOFTWARE_TOTAL, 2)
        sub_rows.append(
            (
                f"SW-LICENSE-2026-EU-{period}",
                period,
                "ND-EU",
                "6100",
                (day0 + timedelta(days=8)).isoformat(),
                "V-207",
                "Annual software license renewal — Parcel Softwares Ltd (SW-LICENSE-2026-EU)",
                C1_SOFTWARE_EXPLAINED,
                "ERP",
                "expense_detail",
            )
        )
        sub_rows.append(
            (
                f"SW-RESIDUAL-UNMATCHED-{period}",
                period,
                "ND-EU",
                "6100",
                (day0 + timedelta(days=15)).isoformat(),
                "V-207",
                "Vendor invoice — no PO / no matching contract reference",
                C1_SOFTWARE_RESIDUAL,
                "ERP",
                "expense_detail",
            )
        )
        if abs(rem) > 0.005:
            rng = random.Random(f"{SEED}:c1:{period}")
            sub_rows.extend(
                build_expense_detail_rows("6100", period, "ND-EU", rem, day0, rng)
            )

    return sub_rows


def build_close_tasks(period: str) -> list[tuple]:
    return [
        (f"T-{period}-01", period, "ND-US", "Post payroll accrual", "Close lead", "done", 1),
        (f"T-{period}-02", period, "ND-US", "Flux accounts over policy thresholds", "FP&A", "in_progress", 2),
        (f"T-{period}-03", period, "ND-US", "AR subledger tie-out", "AR lead", "in_progress", 2),
        (f"T-{period}-04", period, "ND-US", "Review manual JEs >$100K", "Controller", "open", 3),
        (f"T-{period}-05", period, "ND-US", "Deferred revenue rollforward", "Revenue", "open", 3),
        (f"T-{period}-06", period, "ND-EU", "Intercompany confirmations", "EU close", "open", 4),
    ]


def generate(
    db_path: Path = DB_PATH,
    seed: int = DEFAULT_SEED,
    profile: str = "demo",
) -> dict:
    global SEED
    if profile not in {"demo", "holdout"}:
        raise ValueError(f"unknown profile {profile!r}; use demo|holdout")
    SEED = seed
    random.seed(SEED)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()

    periods_dates = month_starts(24)
    periods = [period_label(d) for d in periods_dates]
    conn = sqlite3.connect(db_path)
    ensure_schema(conn)

    conn.execute(
        "INSERT INTO meta(key, value) VALUES (?, ?)",
        ("disclaimer", "SYNTHETIC DATA — Northwind Digital demo only"),
    )
    conn.execute("INSERT INTO meta(key, value) VALUES (?, ?)", ("company", COMPANY))
    conn.execute("INSERT INTO meta(key, value) VALUES (?, ?)", ("seed", str(SEED)))
    conn.execute("INSERT INTO meta(key, value) VALUES (?, ?)", ("profile", profile))
    conn.execute(
        "INSERT INTO meta(key, value) VALUES (?, ?)",
        ("as_of_period", periods[-1]),
    )

    conn.executemany("INSERT INTO accounts VALUES (?, ?, ?, ?)", ACCOUNTS)
    conn.executemany(
        "INSERT INTO parties VALUES (?, ?, ?, ?)",
        [(p[0], p[1], "customer", p[2]) for p in CUSTOMERS]
        + [(p[0], p[1], "vendor", p[2]) for p in VENDORS],
    )

    balances: dict[tuple[str, str, str], float] = {}
    for mi, (period, d) in enumerate(zip(periods, periods_dates)):
        for entity in ENTITIES:
            rng = random.Random(f"{SEED}:{entity}:{period}")
            for acct, *_ in ACCOUNTS:
                balances[(period, entity, acct)] = balance_for(
                    acct, entity, mi, d.month, rng
                )

    from anomaly_extra import (
        override_hard_and_edge,
        override_holdout,
        plant_hard_and_edge,
        plant_holdout,
    )

    if profile == "holdout":
        anomaly_records = plant_holdout(balances, periods)
    else:
        anomaly_records = plant_anomalies(balances, periods)
        anomaly_records.extend(plant_hard_and_edge(balances, periods))

    conn.execute(
        "INSERT INTO meta(key, value) VALUES (?, ?)",
        ("anomalies", ",".join(a.anomaly_id for a in anomaly_records)),
    )

    conn.executemany(
        "INSERT INTO trial_balance(period, entity, account_id, ending_balance) VALUES (?, ?, ?, ?)",
        [(p, e, a, bal) for (p, e, a), bal in balances.items()],
    )

    sub_rows: list[tuple] = []
    for period, d in zip(periods, periods_dates):
        for entity in ENTITIES:
            rng = random.Random(f"{SEED}:sub:{entity}:{period}")
            sub_rows.extend(
                build_ar_rows(period, entity, balances[(period, entity, AR_ACCOUNT)], d, rng)
            )
            sub_rows.extend(
                build_ap_rows(period, entity, balances[(period, entity, AP_ACCOUNT)], d, rng)
            )
            for acct in sorted(ACCRUAL_ACCOUNTS):
                sub_rows.extend(
                    build_accrual_rows(
                        acct, period, entity, balances[(period, entity, acct)], d, rng
                    )
                )
            for acct in sorted(OPEX_DETAIL_ACCOUNTS):
                sub_rows.extend(
                    build_expense_detail_rows(
                        acct, period, entity, balances[(period, entity, acct)], d, rng
                    )
                )
            for acct in sorted(REVENUE_DETAIL_ACCOUNTS):
                sub_rows.extend(
                    build_revenue_detail_rows(
                        acct, period, entity, balances[(period, entity, acct)], d, rng
                    )
                )

    if profile == "holdout":
        sub_rows = override_holdout(sub_rows, balances, periods, SEED)
    else:
        sub_rows = override_subledger_for_anomalies(sub_rows, balances, periods)
        sub_rows = override_hard_and_edge(sub_rows, balances, periods, SEED)

    # Ensure txn_ids unique after overrides
    seen: set[str] = set()
    deduped: list[tuple] = []
    for row in sub_rows:
        if row[0] in seen:
            continue
        seen.add(row[0])
        deduped.append(row)
    sub_rows = deduped

    conn.executemany(
        "INSERT INTO subledger VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        sub_rows,
    )
    conn.executemany(
        "INSERT INTO close_tasks VALUES (?, ?, ?, ?, ?, ?, ?)",
        build_close_tasks(periods[-1]),
    )
    conn.executemany(
        """
        INSERT INTO anomalies(
            anomaly_id, account_id, entity, period, amount, kind,
            explanation, expected_confidence, expected_citations
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                a.anomaly_id,
                a.account_id,
                a.entity,
                a.period,
                a.amount,
                a.kind,
                a.explanation,
                a.expected_confidence,
                json.dumps(list(a.expected_citations)),
            )
            for a in anomaly_records
        ],
    )
    conn.commit()

    export = export_demo_bundle(conn, periods, anomaly_records)
    export_name = "demo_bundle_holdout.json" if profile == "holdout" else "demo_bundle.json"
    export_path = EXPORT_DIR / export_name
    export_path.write_text(json.dumps(export, indent=2), encoding="utf-8")

    summary = {
        "company": COMPANY,
        "db_path": str(db_path),
        "seed": SEED,
        "profile": profile,
        "accounts": len(ACCOUNTS),
        "entities": ENTITIES,
        "periods": len(periods),
        "as_of_period": periods[-1],
        "subledger_rows": len(sub_rows),
        "anomalies": [a.anomaly_id for a in anomaly_records],
        "export_path": str(export_path),
    }
    conn.close()
    return summary


def export_demo_bundle(
    conn: sqlite3.Connection,
    periods: list[str],
    anomaly_records: list[AnomalyRecord],
) -> dict:
    period = periods[-1]
    prior = periods[-2]
    entity = "ND-US"

    def q(sql: str, params: tuple = ()) -> list[dict]:
        cur = conn.execute(sql, params)
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]

    tb = q(
        """
        SELECT t.period, t.entity, t.account_id, a.name, a.account_type, t.ending_balance
        FROM trial_balance t
        JOIN accounts a ON a.account_id = t.account_id
        WHERE t.entity = ? AND t.period IN (?, ?)
        ORDER BY t.account_id, t.period
        """,
        (entity, prior, period),
    )
    sub = q(
        "SELECT * FROM subledger WHERE entity = ? AND period = ? ORDER BY txn_date, txn_id",
        (entity, period),
    )
    tasks = q("SELECT * FROM close_tasks WHERE period = ? ORDER BY due_day", (period,))

    by_key = {(r["account_id"], r["period"]): r["ending_balance"] for r in tb}
    names = {r["account_id"]: r["name"] for r in tb}
    try:
        from policy import load_policy

        pol = load_policy()
        thr_pct = pol.variance.threshold_pct
        thr_amt = pol.variance.threshold_amt
    except Exception:
        thr_pct = None
        thr_amt = None
    variances = []
    for acct, name, *_ in ACCOUNTS:
        a = by_key.get((acct, prior), 0.0)
        b = by_key.get((acct, period), 0.0)
        delta = b - a
        pct = (delta / a) if abs(a) > 1 else (1.0 if abs(delta) > 0 else 0.0)
        if thr_pct is None or thr_amt is None:
            over = False
        else:
            over = abs(pct) > thr_pct and abs(delta) > thr_amt
        variances.append(
            {
                "account_id": acct,
                "account_name": names.get(acct, name),
                "period_a": prior,
                "period_b": period,
                "balance_a": a,
                "balance_b": b,
                "variance_amt": round(delta, 2),
                "variance_pct": round(pct, 4),
                "over_threshold": over,
            }
        )

    return {
        "disclaimer": (
            "All figures are synthetic demo data for fictional company "
            "Northwind Digital — not real company financials."
        ),
        "company": COMPANY,
        "entity": entity,
        "period": period,
        "prior_period": prior,
        "threshold_pct": thr_pct,
        "threshold_amt": thr_amt,
        "trial_balance": tb,
        "subledger": sub,
        "close_tasks": tasks,
        "variances": variances,
        "anomalies": [
            {
                "anomaly_id": a.anomaly_id,
                "account_id": a.account_id,
                "entity": a.entity,
                "period": a.period,
                "amount": a.amount,
                "kind": a.kind,
                "expected_confidence": a.expected_confidence,
                "explanation": a.explanation,
            }
            for a in anomaly_records
        ],
        "note": "Planted anomalies A1–A4, B1–B2, C1 — see data/ANOMALIES.md.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=None, help="Output SQLite path")
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="RNG seed (default 42 demo / 43 holdout)",
    )
    parser.add_argument(
        "--profile",
        choices=("demo", "holdout"),
        default="demo",
        help="demo=A1–C1+hard/S1; holdout=same types remapped (seed 43)",
    )
    args = parser.parse_args()
    profile = args.profile
    seed = args.seed if args.seed is not None else (
        HOLDOUT_SEED if profile == "holdout" else DEFAULT_SEED
    )
    db_path = args.db or (HOLDOUT_DB_PATH if profile == "holdout" else DB_PATH)
    result = generate(db_path=db_path, seed=seed, profile=profile)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
