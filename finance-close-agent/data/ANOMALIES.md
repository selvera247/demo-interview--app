# Planted anomalies — Northwind Digital

Synthetic demo anomalies planted by `generate_data.py` (seed `42`).  
T&E maps to account **6310 Meals & Entertainment**.

| ID | Account | Entity | Period | Amount | Expected confidence |
| --- | --- | --- | --- | --- | --- |
| A1 | 6110 Cloud Hosting | ND-US | 2026-06 | +$85,000 × 2 identical accruals | high |
| A2 | 6020 Contractors | ND-EU | 2026-07 | −$120,000 | high |
| A2B | 6500 Professional Fees | ND-EU | 2026-07 | +$120,000 (paired side of A2) | high |
| A3 | 4000 Subscription Revenue | ND-US | 2026-06 | −$400,000 (extra revenue / credit) | high |
| A3B | 4000 Subscription Revenue | ND-US | 2026-07 | +$400,000 (offset / reversal) | high |
| A4 | 6310 Meals & Entertainment (T&E) | ND-US | 2026-09 | +$70,000 | **low** |
| B1 | 6200 Marketing & Advertising | ND-US | 2026-09 | +$75,000 | high |
| B2 | 6600 Recruiting | ND-US | 2026-03 | +$55,000 | high |

---

## A1 — Duplicate accrual

- **Mechanism:** From 2026-06 onward (sticky), Cloud Hosting TB includes two identical $85,000 accrual rows: same vendor (`V-200` Nimbus Hosting Co), same amount, same reference `ACCR-CLOUD-6110` (txn ids `ACCR-CLOUD-6110-A-*` / `ACCR-CLOUD-6110-B-*`).
- **Expected explanation:** Duplicate month-end Cloud Hosting accrual; reverse one of the two identical postings.
- **Expected confidence:** high (clear duplicate evidence in subledger).

## A2 / A2B — Opex reclass

- **Mechanism:** From 2026-07 onward (sticky), $120,000 moved ND-EU from Contractors (`6020`) to Professional Fees (`6500`) via paired JEs `JE-RCL-6020-*` and `JE-RCL-6500-*` with memos referencing the reclass. Net zero to total opex.
- **Expected explanation:** Classification reclass only; not a spend increase.
- **Expected confidence:** high.

## A3 / A3B — Revenue timing across quarter boundary

- **Mechanism:** ND-US Subscription Revenue (`4000`): extra $400,000 revenue (signed −$400k) recognized in quarter-end **2026-06** via `JE-REV-TIMING-FWD`; memo cites contract `CTR-4000-NDUS` with **start date 2026-07-01**. In **2026-07**, `JE-REV-TIMING-REV` posts the +$400k signed reversal while the TB returns to the normal monthly path (so the MoM swing is the offset side without creating a further Aug breach).
- **Expected explanation:** Premature recognition before contract start; timing swing across the quarter boundary with next-month reversal.
- **Expected confidence:** high.

## A4 — Unexplained T&E

- **Mechanism:** ND-US Meals & Entertainment (`6310`) latest period **2026-09** increased +$70,000 by single manual JE `JE-MANUAL-BLANK`: **blank description**, **no vendor**, no supporting detail. Base activity still present so TB reconciles.
- **Expected explanation:** No reliable driver; do not invent a story.
- **Expected confidence:** **low** → human review queue.

## B1 — Benign conference breach

- **Mechanism:** ND-US Marketing (`6200`) **2026-09** +$75,000 for annual customer conference, fully supported by labeled invoices `CONF-2026-ANNUAL-01/02` (vendor Brightline Marketing / `V-205`).
- **Expected explanation:** Planned annual conference spend; invoices cite `CONF-2026-ANNUAL`.
- **Expected confidence:** high.

## B2 — Benign hiring-season breach

- **Mechanism:** ND-US Recruiting (`6600`) elevated +$55,000 from **2026-03** onward (sticky) with invoices labeled `HIRING-SURGE-2026-Q1` (Cobalt Recruiting / `V-206`).
- **Expected explanation:** Hiring-heavy month / surge recruiting fees.
- **Expected confidence:** high.

## Expected threshold breaches (MoM >10% AND >$50K)

Exactly these period_b breaches (nothing else):

1. A1 — ND-US `6110` 2026-05→2026-06  
2. A2 — ND-EU `6020` 2026-06→2026-07  
3. A2B — ND-EU `6500` 2026-06→2026-07  
4. A3 — ND-US `4000` 2026-05→2026-06  
5. A3B — ND-US `4000` 2026-06→2026-07  
6. A4 — ND-US `6310` 2026-08→2026-09  
7. B1 — ND-US `6200` 2026-08→2026-09  
8. B2 — ND-US `6600` 2026-02→2026-03  
