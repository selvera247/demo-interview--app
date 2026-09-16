import { classifyAr } from "./classification";
import type { ArPayment, ArPosition, ClassificationState, CustomerInvoice } from "./types";

export function daysPastDue(invoice: CustomerInvoice, asOf: string): number {
  if (invoice.status === "paid") return 0;
  const due = new Date(invoice.dueAt);
  const now = new Date(asOf);
  const diff = Math.floor((now.getTime() - due.getTime()) / 86_400_000);
  return Math.max(0, diff);
}

export function collectedFor(invoiceId: string, payments: ArPayment[]): number {
  return payments
    .filter((payment) => payment.invoiceId === invoiceId)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

export function buildArPosition(input: {
  projectId: string;
  asOf: string;
  invoices: CustomerInvoice[];
  payments: ArPayment[];
  anomalyNotes?: string[];
  classificationPin?: Pick<ClassificationState, "pinned" | "pinReason" | "pinnedBy">;
}): ArPosition {
  let billed = 0;
  let collected = 0;
  let current = 0;
  let days1to30 = 0;
  let days31to60 = 0;
  let days61plus = 0;
  let maxPastDue = 0;
  let disputed = false;

  for (const invoice of input.invoices) {
    billed += invoice.amount;
    const paid = collectedFor(invoice.id, input.payments);
    collected += paid;
    const open = Math.max(0, invoice.amount - paid);
    if (invoice.status === "disputed") disputed = true;
    const aging = daysPastDue(invoice, input.asOf);
    maxPastDue = Math.max(maxPastDue, aging);
    if (open <= 0) continue;
    if (aging === 0) current += open;
    else if (aging <= 30) days1to30 += open;
    else if (aging <= 60) days31to60 += open;
    else days61plus += open;
  }

  const outstanding = Math.max(0, billed - collected);
  const suggested = classifyAr({
    billed,
    collected,
    outstanding,
    daysPastDue: maxPastDue,
    disputed,
    anomalyNotes: input.anomalyNotes,
    collectedAheadOfTerms: outstanding === 0 && billed > 0 && maxPastDue === 0,
  });

  const queuePriority =
    disputed || days61plus > 0 ? 1 : days31to60 > 0 ? 2 : days1to30 > 0 ? 3 : outstanding > 0 ? 4 : 9;

  const recommendedAction = disputed
    ? "Resolve dispute with commercial owner before next close."
    : days61plus > 0
      ? "Escalate collections; cash is 61+ days past due."
      : days1to30 > 0 || days31to60 > 0
        ? "Work the aging bucket this week."
        : outstanding > 0
          ? "Monitor; still inside terms."
          : "No open AR.";

  const pin = input.classificationPin;
  return {
    projectId: input.projectId,
    asOf: input.asOf,
    billed,
    collected,
    outstanding,
    current,
    days1to30,
    days31to60,
    days61plus,
    classification: {
      suggested: suggested.suggested,
      rationale: suggested.rationale,
      pinned: pin?.pinned ?? null,
      pinReason: pin?.pinReason ?? "",
      pinnedBy: pin?.pinnedBy ?? null,
    },
    executiveCommentary: suggested.rationale,
    queuePriority,
    recommendedAction,
  };
}
