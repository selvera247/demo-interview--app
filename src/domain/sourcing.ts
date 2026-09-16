import type { Project, PurchaseOrder, SpecField } from "./types";

export class SourcingGateError extends Error {
  readonly code: "missing_project" | "spec_incomplete";
  readonly blockingKeys: string[];

  constructor(code: "missing_project" | "spec_incomplete", message: string, blockingKeys: string[] = []) {
    super(message);
    this.code = code;
    this.blockingKeys = blockingKeys;
  }
}

function fieldBlocksPo(field: SpecField): boolean {
  return field.status !== "confirmed" || !field.value.trim() || !field.ownerId;
}

export function assertCanIssuePurchaseOrder(input: {
  projectId: string | null | undefined;
  dependsOnField?: SpecField | null;
}): void {
  if (!input.projectId) {
    throw new SourcingGateError(
      "missing_project",
      "A purchase order cannot be issued without a project_id."
    );
  }
  const field = input.dependsOnField;
  if (field && fieldBlocksPo(field)) {
    throw new SourcingGateError(
      "spec_incomplete",
      `Cannot issue PO — BOM line depends on unresolved spec (${field.label}).`,
      [field.fieldKey]
    );
  }
}

export function leadTimeThreat(input: {
  project: Project;
  po: Pick<PurchaseOrder, "promisedShipDate" | "issuedAt" | "leadTimeDays" | "status">;
}): boolean {
  if (input.po.status === "cancelled" || input.po.status === "received") return false;
  const promised = new Date(input.po.promisedShipDate);
  const fallback = addDays(new Date(input.po.issuedAt), input.po.leadTimeDays);
  const ship = Number.isNaN(promised.getTime()) ? fallback : promised;
  const need = new Date(input.project.customerRequestedDeliveryDate);
  return ship.getTime() > need.getTime();
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
