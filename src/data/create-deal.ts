import {
  getFieldCatalog,
  structuredFieldKeys,
} from "../domain/field-catalog";
import { formatProjectCode } from "../domain/ids";
import type { FieldStatus, IntakeTemplate, SpecField, User } from "../domain/types";
import type { AppState } from "./seed";

export const SYSTEMS_INTAKE_KEYS = [
  "voltage",
  "load",
  "phase",
  "coolingType",
  "spaceConstraints",
  "requestedDelivery",
  "customerPowerReady",
  "deliveryDefinition",
] as const;

export type SystemsIntakeKey = (typeof SYSTEMS_INTAKE_KEYS)[number];

/** All OCFO catalog keys use structured intake (value / status / owner / note). */
export const OCFO_STRUCTURED_KEYS = structuredFieldKeys("ocfo");

export type OcfoStructuredKey = (typeof OCFO_STRUCTURED_KEYS)[number];

export type IntakeSystemField = {
  value: string;
  status: FieldStatus;
  ownerName: string;
  note: string;
};

export type NewDealIntake = {
  template: IntakeTemplate;
  customerName: string;
  site: string;
  dealName: string;
  requestorName: string;
  requestorTeam: string;
  problemStatement: string;
  expectedOutcome: string;
  tags: string;
  requestName: string;
  cycle: string;
  entity: string;
  requestCode: string;
  impactType: string;
  quantifiedImpact: string;
  controlRisk: string;
  downstreamEffect: string;
  revenueImpact: string;
  auditRisk: string;
  customerImpact: string;
  complexity: string;
  crossFunctionalEffort: string;
  timelinePressure: string;
  controlImpact: string;
  downstreamDependencies: string;
  /** Structured value/status/owner/note fields for the template's systems section. */
  systems: Record<string, IntakeSystemField>;
};

function emptyStructured(keys: readonly string[]): Record<string, IntakeSystemField> {
  return Object.fromEntries(
    keys.map((key) => [
      key,
      { value: "", status: "unresolved" as FieldStatus, ownerName: "", note: "" },
    ])
  );
}

export function emptySystemsIntake(): Record<SystemsIntakeKey, IntakeSystemField> {
  return emptyStructured(SYSTEMS_INTAKE_KEYS) as Record<SystemsIntakeKey, IntakeSystemField>;
}

export function emptyOcfoStructuredIntake(): Record<OcfoStructuredKey, IntakeSystemField> {
  return emptyStructured(OCFO_STRUCTURED_KEYS) as Record<OcfoStructuredKey, IntakeSystemField>;
}

export function emptyStructuredIntake(template: IntakeTemplate): Record<string, IntakeSystemField> {
  return emptyStructured(structuredFieldKeys(template));
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28) || "item";
}

function nextProjectCode(state: AppState, year: number): string {
  let max = 0;
  for (const project of state.projects) {
    const match = project.projectCode.match(/^GE-(\d{4})-(\d{4})$/);
    if (match && Number(match[1]) === year) {
      max = Math.max(max, Number(match[2]));
    }
  }
  return formatProjectCode(year, max + 1);
}

function ensureUser(users: User[], name: string): { users: User[]; ownerId: string | null } {
  const trimmed = name.trim();
  if (!trimmed || /^unassigned$/i.test(trimmed)) {
    return { users, ownerId: null };
  }
  const existing = users.find((user) => user.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return { users, ownerId: existing.id };
  const user: User = {
    id: `u-${slug(trimmed)}-${users.length}`,
    name: trimmed,
    email: `${slug(trimmed)}@internal`,
    role: "commercial",
  };
  return { users: [...users, user], ownerId: user.id };
}

function narrativeStatus(value: string): FieldStatus {
  return value.trim() ? "confirmed" : "unresolved";
}

function resolveNarrative(
  intake: NewDealIntake,
  fieldKey: string
): string {
  if (fieldKey === "revenue_impact") {
    return intake.revenueImpact.trim() || intake.quantifiedImpact;
  }
  if (fieldKey === "audit_revrec_risk") {
    return intake.auditRisk.trim() || intake.controlRisk;
  }
  if (fieldKey === "customer_impact") {
    return intake.customerImpact.trim() || intake.impactType;
  }
  if (fieldKey === "complexity") return intake.complexity;
  if (fieldKey === "cross_functional_effort") return intake.crossFunctionalEffort;
  if (fieldKey === "timeline_pressure") return intake.timelinePressure;
  if (fieldKey === "control_impact") {
    return intake.controlImpact.trim() || intake.controlRisk;
  }
  if (fieldKey === "downstream_dependencies") {
    return intake.downstreamDependencies.trim() || intake.downstreamEffect;
  }
  return "";
}

export function addDealFromIntake(
  state: AppState,
  intake: NewDealIntake,
  nowIso: string
): { state: AppState; projectCode: string } {
  const template: IntakeTemplate = intake.template || "commercial";
  const customerName = intake.customerName.trim();
  if (!customerName) {
    throw new Error(
      template === "ocfo" ? "Organization / entity name is required." : "Customer name is required."
    );
  }

  let users = [...state.users];
  const requestor = ensureUser(users, intake.requestorName);
  users = requestor.users;
  const commercialOwnerId = requestor.ownerId ?? users[0]?.id;
  if (!commercialOwnerId) {
    throw new Error("At least one user must exist to own the deal.");
  }
  const opsOwnerId =
    users.find((user) => (template === "ocfo" ? user.role === "finance" : user.role === "engineering"))
      ?.id ?? commercialOwnerId;

  const year = Number.isNaN(new Date(nowIso).getUTCFullYear())
    ? new Date().getUTCFullYear()
    : new Date(nowIso).getUTCFullYear();
  const projectCode = nextProjectCode(state, year);
  const projectId = `p-${projectCode.replace(/-/g, "").toLowerCase()}`;
  const customerId = `c-${slug(customerName)}-${state.customers.length}`;

  const tags = intake.tags
    .split(/[,;]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  const catalog = getFieldCatalog(template);
  const structuredKeys = new Set(structuredFieldKeys(template));

  const specFields: SpecField[] = catalog.map((entry) => {
    const system = structuredKeys.has(entry.fieldKey) ? intake.systems[entry.fieldKey] : null;

    if (system) {
      const owner = ensureUser(users, system.ownerName);
      users = owner.users;
      let status = system.status;
      if (status === "confirmed" && (!system.value.trim() || !owner.ownerId)) {
        status = "unresolved";
      }
      if (status === "conflicting" && !system.note.trim()) {
        status = system.value.trim() ? "conflicting" : "unresolved";
      }
      return {
        id: `${projectId}-${entry.fieldKey}`,
        projectId,
        section: entry.section,
        fieldKey: entry.fieldKey,
        label: entry.label,
        value: system.value.trim(),
        unit: entry.unit,
        status,
        ownerId: owner.ownerId,
        source: "intake",
        conflictSummary: system.note.trim(),
        required: entry.required,
        updatedAt: nowIso,
      };
    }

    const narrativeValue = resolveNarrative(intake, entry.fieldKey);
    const owner = ensureUser(users, intake.requestorName);
    users = owner.users;
    return {
      id: `${projectId}-${entry.fieldKey}`,
      projectId,
      section: entry.section,
      fieldKey: entry.fieldKey,
      label: entry.label,
      value: narrativeValue.trim(),
      unit: entry.unit,
      status: narrativeStatus(narrativeValue),
      ownerId: narrativeValue.trim() ? owner.ownerId : null,
      source: "intake",
      conflictSummary: "",
      required: entry.required,
      updatedAt: nowIso,
    };
  });

  const dealName = intake.dealName.trim() || intake.requestName.trim() || customerName;
  const requestName = intake.requestName.trim() || dealName;
  const requestCode = intake.requestCode.trim() || projectCode;

  return {
    projectCode,
    state: {
      ...state,
      users,
      customers: [
        ...state.customers,
        {
          id: customerId,
          name: customerName,
          segment: template === "ocfo" ? "colo" : "colo",
        },
      ],
      projects: [
        ...state.projects,
        {
          id: projectId,
          projectCode,
          customerId,
          siteName: intake.site.trim() || intake.entity.trim() || "Site TBD",
          dealName,
          stage: "intake",
          status: "active",
          quotedRevenue: 0,
          currency: "USD",
          customerRequestedDeliveryDate: "2099-12-31",
          commercialOwnerId,
          opsOwnerId,
          quoteFrozenAt: null,
          bomLocked: false,
          requestorName: intake.requestorName.trim() || "Unassigned",
          requestorTeam:
            intake.requestorTeam.trim() || (template === "ocfo" ? "OCFO" : "Sales"),
          problemStatement: intake.problemStatement.trim(),
          expectedOutcome: intake.expectedOutcome.trim(),
          tags,
          template,
          requestName,
          cycle: intake.cycle.trim(),
          entity: intake.entity.trim() || intake.site.trim(),
          requestCode,
          impactType: intake.impactType.trim(),
          quantifiedImpact: intake.quantifiedImpact.trim() || intake.revenueImpact.trim(),
          controlRisk: intake.controlRisk.trim() || intake.auditRisk.trim(),
          downstreamEffect:
            intake.downstreamEffect.trim() || intake.downstreamDependencies.trim(),
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
      specFields: [...state.specFields, ...specFields],
    },
  };
}
