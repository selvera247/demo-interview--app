import { buildCostPosition } from "../domain/cost";
import { leadTimeThreat } from "../domain/sourcing";
import { summarizeSystemsFields } from "../domain/spec";
import type { AmountByCategory, CostCategory, FieldStatus, Project, SpecField } from "../domain/types";
import type { AppState } from "./seed";

export type DealViewStatus = "confirmed" | "conflicting" | "tbd";

export interface DealFieldView {
  value: string | null;
  status: DealViewStatus;
  owner: string;
  note?: string;
}

export interface DealCostLog {
  date: string;
  type: string;
  desc: string;
  amount: number;
  category: CostCategory;
  flag?: boolean;
}

export interface DealSourcingItem {
  item: string;
  supplier: string;
  poNumber: string | null;
  poStatus: string;
  committedAmount: number;
  leadTimeWeeks: number | null;
  requestedBy: string | null;
  projectedArrival: string | null;
  tagged: boolean;
  flag: string | null;
}

export interface DealView {
  id: string;
  customer: string;
  site: string;
  stage: Project["stage"];
  meta: {
    requestor: string;
    requestorTeam: string;
    problemStatement: string;
    expectedOutcome: string;
    revenueImpact: string;
    auditRisk: string;
    customerImpact: string;
    complexity: string;
    crossFunctionalEffort: string;
    timelinePressure: string;
    controlImpact: string;
    downstreamDependencies: string;
    tags: string[];
  };
  fields: Record<string, DealFieldView>;
  cost: {
    quoted: AmountByCategory;
    committed: AmountByCategory;
    actual: AmountByCategory;
    log: DealCostLog[];
  };
  sourcing: {
    bomLocked: boolean;
    items: DealSourcingItem[];
  };
}

const SYSTEMS_ORDER = [
  "voltage",
  "load",
  "phase",
  "coolingType",
  "spaceConstraints",
  "requestedDelivery",
  "customerPowerReady",
  "deliveryDefinition",
] as const;

function toViewStatus(status: FieldStatus): DealViewStatus {
  if (status === "unresolved") return "tbd";
  return status;
}

function ownerLabel(state: AppState, ownerId: string | null): string {
  if (!ownerId) return "Unassigned";
  const user = state.users.find((row) => row.id === ownerId);
  if (!user) return "Unassigned";
  if (user.role === "commercial") return `Sales — ${user.name}`;
  if (user.role === "engineering") return user.name === "Engineering" ? "Engineering" : `Engineering — ${user.name}`;
  return user.name;
}

function fieldValue(fields: SpecField[], key: string): string {
  return fields.find((field) => field.fieldKey === key)?.value || "";
}

export function projectSystemsSummary(state: AppState, projectId: string) {
  return summarizeSystemsFields(state.specFields.filter((field) => field.projectId === projectId));
}

export function toDealViews(state: AppState): DealView[] {
  return state.projects.map((project) => toDealView(state, project));
}

export function toDealView(state: AppState, project: Project): DealView {
  const fields = state.specFields.filter((field) => field.projectId === project.id);
  const customer = state.customers.find((row) => row.id === project.customerId);
  const systems: Record<string, DealFieldView> = {};
  for (const key of SYSTEMS_ORDER) {
    const field = fields.find((row) => row.fieldKey === key);
    systems[key] = {
      value: field?.value?.trim() ? field.value : null,
      status: field ? toViewStatus(field.status) : "tbd",
      owner: ownerLabel(state, field?.ownerId ?? null),
      note: field?.conflictSummary?.trim() ? field.conflictSummary : undefined,
    };
  }

  const pos = state.purchaseOrders.filter((row) => row.projectId === project.id);
  const labor = state.laborEntries.filter((row) => row.projectId === project.id);
  const invoices = state.supplierInvoices.filter((row) => row.projectId === project.id);
  const linesByPoId: Record<string, { costCategory: CostCategory; qty: number; unitCost: number }[]> = {};
  for (const line of state.poLines.filter((row) => row.projectId === project.id)) {
    linesByPoId[line.poId] ??= [];
    linesByPoId[line.poId].push({
      costCategory: line.costCategory,
      qty: line.qty,
      unitCost: line.unitCost,
    });
  }
  const quote = state.quoteSnapshots
    .filter((row) => row.projectId === project.id)
    .sort((a, b) => b.version - a.version)[0] ?? null;
  const position = buildCostPosition({
    projectId: project.id,
    asOf: project.updatedAt,
    quotedRevenue: project.quotedRevenue,
    quote,
    purchaseOrders: pos,
    laborEntries: labor,
    invoices,
    linesByPoId,
  });

  const log: DealCostLog[] = [];
  for (const po of pos) {
    if (po.totalAmount <= 0) continue;
    log.push({
      date: po.issuedAt.slice(0, 10),
      type: po.documentType === "wo" ? "WO issued" : "PO issued",
      desc: po.notes || po.poNumber,
      amount: po.totalAmount,
      category: state.poLines.find((line) => line.poId === po.id)?.costCategory ?? "materials",
    });
  }
  for (const entry of labor) {
    log.push({
      date: entry.committedAt.slice(0, 10),
      type: "Labor logged",
      desc: entry.notes || entry.role,
      amount: entry.amount,
      category: entry.costCategory,
    });
  }
  for (const invoice of invoices) {
    log.push({
      date: invoice.invoicedAt.slice(0, 10),
      type: "Invoice received",
      desc: invoice.invoiceNumber,
      amount: invoice.amount,
      category: invoice.costCategory,
      flag: invoice.invoiceNumber === "ENG-8829",
    });
  }
  log.sort((a, b) => a.date.localeCompare(b.date));

  const items: DealSourcingItem[] = state.bomItems
    .filter((item) => item.projectId === project.id)
    .map((item) => {
      const line = state.poLines.find((row) => row.bomItemId === item.id);
      const po = line ? pos.find((row) => row.id === line.poId) : undefined;
      const supplier = po
        ? state.suppliers.find((row) => row.id === po.supplierId)
        : undefined;
      const depends = item.dependsOnFieldKey
        ? fields.find((field) => field.fieldKey === item.dependsOnFieldKey)
        : undefined;
      const blocked = Boolean(depends && (depends.status !== "confirmed" || !depends.value.trim()));
      let flag: string | null = null;
      if (project.id === "p-0422" && po?.poNumber === "PO-10491") {
        flag =
          "Opportunity OPP-0422 Closed Won $4.8M / 8 MW (contract signed) vs ERP SO-10491 + PO-10491 $3.2M / 5 MW — $1.6M gap. Hold further buy until opportunity, sales order, and PO match.";
      } else if (project.id === "p-0422" && blocked) {
        flag =
          "Opportunity/contract expect this expansion ($1.6M / 3 MW) but ERP has no matching sales order or PO line. Blocked until the commercial chain reconciles.";
      } else if (blocked && depends) {
        flag = `Cannot issue PO — BOM line depends on unresolved spec (${depends.label}). Blocked until that field is confirmed.`;
      } else if (po && leadTimeThreat({ project, po })) {
        const weeks = Math.round(po.leadTimeDays / 7);
        flag = `Lead time (${weeks} wks) pushes arrival past requested ${fieldValue(fields, "requestedDelivery")} delivery — tight margin against customer date.`;
      }
      return {
        item: item.description,
        supplier: supplier?.name ?? (blocked ? "TBD" : "—"),
        poNumber: po?.poNumber ?? null,
        poStatus: blocked ? "blocked" : po?.status.replace("_", " ") ?? "blocked",
        committedAmount: po?.totalAmount ?? 0,
        leadTimeWeeks: po ? Math.round(po.leadTimeDays / 7) : null,
        requestedBy: null,
        projectedArrival: po?.promisedShipDate ?? null,
        tagged: Boolean(po),
        flag,
      };
    });

  return {
    id: project.projectCode,
    customer: customer?.name ?? project.dealName,
    site: project.siteName,
    stage: project.stage,
    meta: {
      requestor: project.requestorName,
      requestorTeam: project.requestorTeam,
      problemStatement: project.problemStatement,
      expectedOutcome: project.expectedOutcome,
      revenueImpact: fieldValue(fields, "revenue_impact"),
      auditRisk: fieldValue(fields, "audit_revrec_risk"),
      customerImpact: fieldValue(fields, "customer_impact"),
      complexity: fieldValue(fields, "complexity"),
      crossFunctionalEffort: fieldValue(fields, "cross_functional_effort"),
      timelinePressure: fieldValue(fields, "timeline_pressure"),
      controlImpact: fieldValue(fields, "control_impact"),
      downstreamDependencies: fieldValue(fields, "downstream_dependencies"),
      tags: project.tags,
    },
    fields: systems,
    cost: {
      quoted: {
        materials: position.quoted.materials,
        labor: position.quoted.labor,
        engineering: position.quoted.engineering,
        freight: position.quoted.freight,
      },
      committed: {
        materials: position.committed.materials,
        labor: position.committed.labor,
        engineering: position.committed.engineering,
        freight: position.committed.freight,
      },
      actual: {
        materials: position.actual.materials,
        labor: position.actual.labor,
        engineering: position.actual.engineering,
        freight: position.actual.freight,
      },
      log,
    },
    sourcing: {
      bomLocked: project.bomLocked,
      items,
    },
  };
}
