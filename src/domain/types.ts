export type ProjectStage = "intake" | "engineering" | "sourcing" | "invoicing";

export type ProjectStatus = "active" | "on_hold" | "cancelled";

export type FieldStatus = "confirmed" | "conflicting" | "unresolved";

export type SpecSection = "systems" | "business_impact" | "effort_timing" | "controls";

export type CostCategory = "materials" | "labor" | "engineering" | "freight";

export type PoStatus =
  | "ordered"
  | "confirmed"
  | "in_production"
  | "shipped"
  | "received"
  | "cancelled";

export type DocumentType = "po" | "wo";

export type InvoiceStatus = "billed" | "partial" | "paid" | "disputed";

export type MovementClass = "risk" | "timing" | "anomaly" | "improvement";

export type CostLayer = "quoted" | "committed" | "actual";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "commercial" | "ops" | "engineering" | "finance" | "collections";
}

export interface Customer {
  id: string;
  name: string;
  segment: "hyperscale" | "colo" | "industrial";
}

export interface Project {
  id: string;
  projectCode: string;
  customerId: string;
  siteName: string;
  dealName: string;
  stage: ProjectStage;
  status: ProjectStatus;
  quotedRevenue: number;
  currency: string;
  customerRequestedDeliveryDate: string;
  commercialOwnerId: string;
  opsOwnerId: string;
  quoteFrozenAt: string | null;
  bomLocked: boolean;
  requestorName: string;
  requestorTeam: string;
  problemStatement: string;
  expectedOutcome: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SpecField {
  id: string;
  projectId: string;
  section: SpecSection;
  fieldKey: string;
  label: string;
  value: string;
  unit: string | null;
  status: FieldStatus;
  ownerId: string | null;
  source: string;
  conflictSummary: string;
  required: boolean;
  updatedAt: string;
}

export interface QuoteSnapshot {
  id: string;
  projectId: string;
  version: number;
  frozenAt: string;
  materials: number;
  labor: number;
  engineering: number;
  freight: number;
  note: string;
}

export interface BomItem {
  id: string;
  projectId: string;
  specFieldId: string | null;
  dependsOnFieldKey: string | null;
  sku: string;
  description: string;
  costCategory: CostCategory;
  qty: number;
  uom: string;
  unitQuotedCost: number;
}

export interface Supplier {
  id: string;
  name: string;
  typicalLeadTimeDays: number;
  terms: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  projectId: string;
  supplierId: string;
  documentType: DocumentType;
  status: PoStatus;
  issuedAt: string;
  leadTimeDays: number;
  promisedShipDate: string;
  totalAmount: number;
  notes: string;
}

export interface PoLine {
  id: string;
  poId: string;
  projectId: string;
  bomItemId: string | null;
  description: string;
  qty: number;
  unitCost: number;
  costCategory: CostCategory;
}

export interface LaborEntry {
  id: string;
  projectId: string;
  committedAt: string;
  role: string;
  hours: number;
  rate: number;
  amount: number;
  costCategory: CostCategory;
  notes: string;
}

export interface SupplierInvoice {
  id: string;
  projectId: string;
  poId: string | null;
  invoiceNumber: string;
  invoicedAt: string;
  paidAt: string | null;
  amount: number;
  costCategory: CostCategory;
  status: "invoiced" | "paid";
}

export interface CustomerInvoice {
  id: string;
  projectId: string;
  invoiceNumber: string;
  billedAt: string;
  dueAt: string;
  amount: number;
  milestone: string;
  status: InvoiceStatus;
}

export interface ArPayment {
  id: string;
  invoiceId: string;
  projectId: string;
  receivedAt: string;
  amount: number;
}

export interface ClassificationState {
  suggested: MovementClass;
  rationale: string;
  pinned: MovementClass | null;
  pinReason: string;
  pinnedBy: string | null;
}

export interface CostPosition {
  projectId: string;
  asOf: string;
  quoted: Record<CostCategory, number> & { total: number };
  committed: Record<CostCategory, number> & { total: number };
  actual: Record<CostCategory, number> & { total: number };
  committedPctOfQuote: number;
  earlyWarning85: boolean;
  classification: ClassificationState;
}

export interface ArPosition {
  projectId: string;
  asOf: string;
  billed: number;
  collected: number;
  outstanding: number;
  current: number;
  days1to30: number;
  days31to60: number;
  days61plus: number;
  classification: ClassificationState;
  executiveCommentary: string;
  queuePriority: number;
  recommendedAction: string;
}

export type AmountByCategory = Record<CostCategory, number>;

export const COST_CATEGORIES: CostCategory[] = [
  "materials",
  "labor",
  "engineering",
  "freight",
];

export const EMPTY_CATEGORY_AMOUNTS: AmountByCategory = {
  materials: 0,
  labor: 0,
  engineering: 0,
  freight: 0,
};

export function categoryTotal(amounts: AmountByCategory): number {
  return COST_CATEGORIES.reduce((sum, key) => sum + amounts[key], 0);
}
