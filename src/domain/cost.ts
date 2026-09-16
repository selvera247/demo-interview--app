import { classifyCost, EARLY_WARNING_PCT } from "./classification";
import {
  COST_CATEGORIES,
  EMPTY_CATEGORY_AMOUNTS,
  categoryTotal,
  type AmountByCategory,
  type ClassificationState,
  type CostPosition,
  type LaborEntry,
  type PurchaseOrder,
  type QuoteSnapshot,
  type SupplierInvoice,
} from "./types";

export function amountsFromQuote(snapshot: QuoteSnapshot | null): AmountByCategory {
  if (!snapshot) return { ...EMPTY_CATEGORY_AMOUNTS };
  return {
    materials: snapshot.materials,
    labor: snapshot.labor,
    engineering: snapshot.engineering,
    freight: snapshot.freight,
  };
}

export function committedAmounts(input: {
  purchaseOrders: PurchaseOrder[];
  laborEntries: LaborEntry[];
  poCategoryTotals: AmountByCategory;
}): AmountByCategory {
  const next = { ...EMPTY_CATEGORY_AMOUNTS };
  for (const category of COST_CATEGORIES) {
    next[category] = input.poCategoryTotals[category];
  }
  for (const row of input.laborEntries) {
    next[row.costCategory] += row.amount;
  }
  return next;
}

export function poCategoryTotals(
  pos: PurchaseOrder[],
  linesByPoId: Record<string, { costCategory: keyof AmountByCategory; qty: number; unitCost: number }[]>
): AmountByCategory {
  const next = { ...EMPTY_CATEGORY_AMOUNTS };
  for (const po of pos) {
    if (po.status === "cancelled") continue;
    const lines = linesByPoId[po.id] ?? [];
    if (lines.length === 0) {
      next.materials += po.totalAmount;
      continue;
    }
    for (const line of lines) {
      next[line.costCategory] += line.qty * line.unitCost;
    }
  }
  return next;
}

export function actualAmounts(invoices: SupplierInvoice[]): AmountByCategory {
  const next = { ...EMPTY_CATEGORY_AMOUNTS };
  for (const invoice of invoices) {
    next[invoice.costCategory] += invoice.amount;
  }
  return next;
}

export function liveMargin(quotedRevenue: number, committedTotal: number): number {
  return quotedRevenue - committedTotal;
}

export function buildCostPosition(input: {
  projectId: string;
  asOf: string;
  quotedRevenue: number;
  quote: QuoteSnapshot | null;
  purchaseOrders: PurchaseOrder[];
  laborEntries: LaborEntry[];
  invoices: SupplierInvoice[];
  linesByPoId: Record<string, { costCategory: keyof AmountByCategory; qty: number; unitCost: number }[]>;
  anomalyNotes?: string[];
  committedAheadOfPlan?: boolean;
  classificationPin?: Pick<ClassificationState, "pinned" | "pinReason" | "pinnedBy">;
}): CostPosition & { liveMargin: number } {
  const quoted = amountsFromQuote(input.quote);
  const committed = committedAmounts({
    purchaseOrders: input.purchaseOrders,
    laborEntries: input.laborEntries,
    poCategoryTotals: poCategoryTotals(input.purchaseOrders, input.linesByPoId),
  });
  const actual = actualAmounts(input.invoices);
  const quotedTotal = categoryTotal(quoted);
  const committedTotal = categoryTotal(committed);
  const actualTotal = categoryTotal(actual);
  const suggested = classifyCost({
    quoted: quotedTotal,
    committed: committedTotal,
    actual: actualTotal,
    anomalyNotes: input.anomalyNotes,
    committedAheadOfPlan: input.committedAheadOfPlan,
  });
  const pin = input.classificationPin;
  return {
    projectId: input.projectId,
    asOf: input.asOf,
    quoted: { ...quoted, total: quotedTotal },
    committed: { ...committed, total: committedTotal },
    actual: { ...actual, total: actualTotal },
    committedPctOfQuote: quotedTotal === 0 ? 0 : committedTotal / quotedTotal,
    earlyWarning85: quotedTotal > 0 && committedTotal / quotedTotal >= EARLY_WARNING_PCT,
    classification: {
      suggested: suggested.suggested,
      rationale: suggested.rationale,
      pinned: pin?.pinned ?? null,
      pinReason: pin?.pinReason ?? "",
      pinnedBy: pin?.pinnedBy ?? null,
    },
    liveMargin: liveMargin(input.quotedRevenue, committedTotal),
  };
}

export function assertQuoteImmutable(
  existing: QuoteSnapshot | undefined,
  patch: Partial<QuoteSnapshot>
): string | null {
  if (!existing) return null;
  const keys: (keyof QuoteSnapshot)[] = [
    "materials",
    "labor",
    "engineering",
    "freight",
    "frozenAt",
    "version",
  ];
  for (const key of keys) {
    if (patch[key] !== undefined && patch[key] !== existing[key]) {
      return "Frozen quote snapshots are immutable. Create a new version.";
    }
  }
  return null;
}
