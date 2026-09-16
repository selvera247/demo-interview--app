import { FIELD_CATALOG, SYSTEMS_FIELD_KEYS } from "./field-catalog";
import type { SpecField } from "./types";

export interface SpecReadiness {
  totalRequired: number;
  confirmedRequired: number;
  unresolvedRequired: number;
  conflictingRequired: number;
  percentConfirmed: number;
  blockingKeys: string[];
  canLockBom: boolean;
}

function isConfirmed(field: SpecField | undefined): boolean {
  return Boolean(
    field &&
      field.status === "confirmed" &&
      field.value.trim() &&
      field.ownerId
  );
}

export function evaluateSpecReadiness(fields: SpecField[]): SpecReadiness {
  const requiredKeys = new Set(
    FIELD_CATALOG.filter((entry) => entry.required).map((entry) => entry.fieldKey)
  );
  const byKey = new Map(fields.map((field) => [field.fieldKey, field]));
  const blockingKeys: string[] = [];
  let confirmedRequired = 0;
  let unresolvedRequired = 0;
  let conflictingRequired = 0;

  for (const key of requiredKeys) {
    const field = byKey.get(key);
    if (isConfirmed(field)) {
      confirmedRequired += 1;
      continue;
    }
    if (field?.status === "conflicting") {
      conflictingRequired += 1;
    } else {
      unresolvedRequired += 1;
    }
    blockingKeys.push(key);
  }

  const totalRequired = requiredKeys.size;
  return {
    totalRequired,
    confirmedRequired,
    unresolvedRequired,
    conflictingRequired,
    percentConfirmed: totalRequired === 0 ? 0 : confirmedRequired / totalRequired,
    blockingKeys,
    canLockBom: blockingKeys.length === 0,
  };
}

export function summarizeSystemsFields(fields: SpecField[]): {
  unresolved: number;
  conflicting: number;
  complete: boolean;
} {
  const systems = fields.filter((field) => SYSTEMS_FIELD_KEYS.includes(field.fieldKey));
  const unresolved = systems.filter((field) => field.status === "unresolved").length;
  const conflicting = systems.filter((field) => field.status === "conflicting").length;
  return { unresolved, conflicting, complete: unresolved === 0 && conflicting === 0 };
}

export function assertCanConfirmField(field: Pick<SpecField, "value" | "ownerId" | "status">): string | null {
  if (!field.value.trim()) return "A confirmed field needs a value.";
  if (!field.ownerId) return "A confirmed field needs an owner.";
  return null;
}

export function withFieldStatus(
  field: SpecField,
  next: { status: SpecField["status"]; value?: string; ownerId?: string | null; conflictSummary?: string; source?: string },
  nowIso: string
): { field: SpecField; error: string | null } {
  const merged: SpecField = {
    ...field,
    ...next,
    updatedAt: nowIso,
  };
  if (merged.status === "confirmed") {
    const error = assertCanConfirmField(merged);
    if (error) return { field, error };
  }
  if (merged.status === "conflicting" && !merged.conflictSummary.trim()) {
    return { field, error: "Conflicting fields need a conflict summary." };
  }
  return { field: merged, error: null };
}
