import { FIELD_CATALOG } from "../domain/field-catalog";
import { formatProjectCode } from "../domain/ids";
import type { FieldStatus, SpecField, User } from "../domain/types";
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

export type IntakeSystemField = {
  value: string;
  status: FieldStatus;
  ownerName: string;
  note: string;
};

export type NewDealIntake = {
  customerName: string;
  site: string;
  dealName: string;
  requestorName: string;
  requestorTeam: string;
  problemStatement: string;
  expectedOutcome: string;
  tags: string;
  revenueImpact: string;
  auditRisk: string;
  customerImpact: string;
  complexity: string;
  crossFunctionalEffort: string;
  timelinePressure: string;
  controlImpact: string;
  downstreamDependencies: string;
  systems: Record<SystemsIntakeKey, IntakeSystemField>;
};

export function emptySystemsIntake(): Record<SystemsIntakeKey, IntakeSystemField> {
  return Object.fromEntries(
    SYSTEMS_INTAKE_KEYS.map((key) => [
      key,
      { value: "", status: "unresolved" as FieldStatus, ownerName: "", note: "" },
    ])
  ) as Record<SystemsIntakeKey, IntakeSystemField>;
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

export function addDealFromIntake(
  state: AppState,
  intake: NewDealIntake,
  nowIso: string
): { state: AppState; projectCode: string } {
  const customerName = intake.customerName.trim();
  if (!customerName) {
    throw new Error("Customer name is required.");
  }

  let users = [...state.users];
  const requestor = ensureUser(users, intake.requestorName);
  users = requestor.users;
  const commercialOwnerId = requestor.ownerId ?? users[0]?.id;
  if (!commercialOwnerId) {
    throw new Error("At least one user must exist to own the deal.");
  }
  const opsOwnerId = users.find((user) => user.role === "engineering")?.id ?? commercialOwnerId;

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

  const specFields: SpecField[] = FIELD_CATALOG.map((entry) => {
    const system = SYSTEMS_INTAKE_KEYS.includes(entry.fieldKey as SystemsIntakeKey)
      ? intake.systems[entry.fieldKey as SystemsIntakeKey]
      : null;
    const narrativeValue =
      entry.fieldKey === "revenue_impact"
        ? intake.revenueImpact
        : entry.fieldKey === "audit_revrec_risk"
          ? intake.auditRisk
          : entry.fieldKey === "customer_impact"
            ? intake.customerImpact
            : entry.fieldKey === "complexity"
              ? intake.complexity
              : entry.fieldKey === "cross_functional_effort"
                ? intake.crossFunctionalEffort
                : entry.fieldKey === "timeline_pressure"
                  ? intake.timelinePressure
                  : entry.fieldKey === "control_impact"
                    ? intake.controlImpact
                    : entry.fieldKey === "downstream_dependencies"
                      ? intake.downstreamDependencies
                      : "";

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

  return {
    projectCode,
    state: {
      ...state,
      users,
      customers: [
        ...state.customers,
        { id: customerId, name: customerName, segment: "colo" },
      ],
      projects: [
        ...state.projects,
        {
          id: projectId,
          projectCode,
          customerId,
          siteName: intake.site.trim() || "Site TBD",
          dealName: intake.dealName.trim() || customerName,
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
          requestorTeam: intake.requestorTeam.trim() || "Sales",
          problemStatement: intake.problemStatement.trim(),
          expectedOutcome: intake.expectedOutcome.trim(),
          tags,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
      specFields: [...state.specFields, ...specFields],
    },
  };
}
