import type { MovementClass } from "./types";

export const EARLY_WARNING_PCT = 0.85;

export interface CostMovementInput {
  quoted: number;
  committed: number;
  actual: number;
  priorCommitted?: number;
  anomalyNotes?: string[];
  committedAheadOfPlan?: boolean;
}

export interface ArMovementInput {
  billed: number;
  collected: number;
  outstanding: number;
  daysPastDue: number;
  disputed?: boolean;
  anomalyNotes?: string[];
  collectedAheadOfTerms?: boolean;
}

export interface ClassificationResult {
  suggested: MovementClass;
  rationale: string;
}

export function effectiveClass(state: {
  suggested: MovementClass;
  pinned: MovementClass | null;
}): MovementClass {
  return state.pinned ?? state.suggested;
}

export function classifyCost(input: CostMovementInput): ClassificationResult {
  if (input.anomalyNotes && input.anomalyNotes.length > 0) {
    return {
      suggested: "anomaly",
      rationale: input.anomalyNotes.join("; "),
    };
  }
  if (input.quoted <= 0) {
    return {
      suggested: "anomaly",
      rationale: "No frozen quote baseline; cost movement cannot be classified against quote.",
    };
  }
  const pct = input.committed / input.quoted;
  if (input.committed > input.quoted || pct >= EARLY_WARNING_PCT) {
    return {
      suggested: "risk",
      rationale:
        pct >= EARLY_WARNING_PCT
          ? `Committed cost is ${(pct * 100).toFixed(0)}% of quote (threshold ${EARLY_WARNING_PCT * 100}%).`
          : "Committed cost exceeds frozen quote.",
    };
  }
  if (input.committedAheadOfPlan) {
    return {
      suggested: "timing",
      rationale: "POs issued ahead of plan; projected final still inside quote.",
    };
  }
  if (input.committed < input.quoted * 0.95) {
    return {
      suggested: "improvement",
      rationale: "Committed tracking below frozen quote; margin expanding vs freeze.",
    };
  }
  return {
    suggested: "timing",
    rationale: "In-band movement versus quote; no 85% breach.",
  };
}

export function classifyAr(input: ArMovementInput): ClassificationResult {
  if (input.anomalyNotes && input.anomalyNotes.length > 0) {
    return {
      suggested: "anomaly",
      rationale: input.anomalyNotes.join("; "),
    };
  }
  if (input.disputed || input.daysPastDue > 0) {
    return {
      suggested: "risk",
      rationale: input.disputed
        ? "Invoice disputed; cash and recognition at risk."
        : `${input.daysPastDue} days past due.`,
    };
  }
  if (input.collectedAheadOfTerms) {
    return {
      suggested: "improvement",
      rationale: "Collections running ahead of terms.",
    };
  }
  if (input.outstanding > 0 && input.daysPastDue === 0) {
    return {
      suggested: "timing",
      rationale: "Open AR still inside terms.",
    };
  }
  return {
    suggested: "improvement",
    rationale: "Billed amount collected in full.",
  };
}

export function assertPinReason(pin: MovementClass | null, reason: string): string | null {
  if (pin && !reason.trim()) return "A pinned classification needs a reason.";
  return null;
}
