import { FIELD_CATALOG } from "../domain/field-catalog";
import type {
  ArPayment,
  BomItem,
  Customer,
  CustomerInvoice,
  LaborEntry,
  PoLine,
  Project,
  PurchaseOrder,
  QuoteSnapshot,
  SpecField,
  Supplier,
  SupplierInvoice,
  User,
} from "../domain/types";

export interface AppState {
  users: User[];
  customers: Customer[];
  projects: Project[];
  specFields: SpecField[];
  quoteSnapshots: QuoteSnapshot[];
  bomItems: BomItem[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  poLines: PoLine[];
  laborEntries: LaborEntry[];
  supplierInvoices: SupplierInvoice[];
  customerInvoices: CustomerInvoice[];
  arPayments: ArPayment[];
  costPins: Record<string, { pinned: "risk" | "timing" | "anomaly" | "improvement"; pinReason: string; pinnedBy: string }>;
  arPins: Record<string, { pinned: "risk" | "timing" | "anomaly" | "improvement"; pinReason: string; pinnedBy: string }>;
}

const now = "2026-09-16T15:00:00.000Z";

type FieldDraft = {
  value: string;
  status: SpecField["status"];
  ownerId: string | null;
  source?: string;
  conflict?: string;
};

function fieldsFor(projectId: string, values: Record<string, FieldDraft>): SpecField[] {
  return FIELD_CATALOG.map((entry) => {
    const override = values[entry.fieldKey];
    return {
      id: `${projectId}-${entry.fieldKey}`,
      projectId,
      section: entry.section,
      fieldKey: entry.fieldKey,
      label: entry.label,
      value: override?.value ?? "",
      unit: entry.unit,
      status: override?.status ?? "unresolved",
      ownerId: override?.ownerId ?? null,
      source: override?.source ?? "",
      conflictSummary: override?.conflict ?? "",
      required: entry.required,
      updatedAt: now,
    };
  });
}

const confirmed = (value: string, ownerId: string, source = "Sales"): FieldDraft => ({
  value,
  status: "confirmed",
  ownerId,
  source,
});

export function createSeedState(): AppState {
  const users: User[] = [
    { id: "u-cole", name: "R. Cole", email: "rcole@internal", role: "commercial" },
    { id: "u-alvarez", name: "J. Alvarez", email: "jalvarez@internal", role: "commercial" },
    { id: "u-whitfield", name: "T. Whitfield", email: "twhitfield@internal", role: "commercial" },
    { id: "u-eng", name: "Engineering", email: "engineering@internal", role: "engineering" },
    { id: "u-contracts", name: "Contracts", email: "contracts@internal", role: "finance" },
    { id: "u-singh", name: "K. Singh", email: "ksingh@internal", role: "finance" },
  ];

  const customers: Customer[] = [
    { id: "c-northgate", name: "Northgate AI Colocation", segment: "colo" },
    { id: "c-permian", name: "Permian Ridge Mining Co.", segment: "industrial" },
    { id: "c-cedar", name: "Cedar Point Data Partners", segment: "colo" },
    { id: "c-lakeside", name: "Lakeside Inference Co.", segment: "colo" },
  ];

  const cole = "u-cole";
  const alvarez = "u-alvarez";
  const whitfield = "u-whitfield";
  const eng = "u-eng";
  const contracts = "u-contracts";
  const singh = "u-singh";

  const projects: Project[] = [
    {
      id: "p-0417",
      projectCode: "GE-2026-0417",
      customerId: "c-northgate",
      siteName: "Baytown, TX",
      dealName: "18MW modular power/cooling",
      stage: "engineering",
      status: "active",
      quotedRevenue: 3_100_000,
      currency: "USD",
      customerRequestedDeliveryDate: "2027-01-10",
      commercialOwnerId: cole,
      opsOwnerId: eng,
      quoteFrozenAt: "2026-08-01T00:00:00.000Z",
      bomLocked: false,
      requestorName: "R. Cole",
      requestorTeam: "Sales — Enterprise",
      problemStatement:
        "Customer needs 18MW of modular power/cooling infrastructure for a new AI colocation facility, targeting Q1 2027 go-live.",
      expectedOutcome:
        "Fully specified, quoted, and contracted deal ready to hand to engineering with no open ambiguity.",
      tags: ["Urgent", "Revenue"],
      createdAt: "2026-07-20T12:00:00.000Z",
      updatedAt: now,
    },
    {
      id: "p-0398",
      projectCode: "GE-2026-0398",
      customerId: "c-permian",
      siteName: "Midland, TX",
      dealName: "6MW standard modular power",
      stage: "sourcing",
      status: "active",
      quotedRevenue: 1_100_000,
      currency: "USD",
      customerRequestedDeliveryDate: "2026-11-30",
      commercialOwnerId: alvarez,
      opsOwnerId: eng,
      quoteFrozenAt: "2026-06-15T00:00:00.000Z",
      bomLocked: true,
      requestorName: "J. Alvarez",
      requestorTeam: "Sales — Mining",
      problemStatement:
        "Customer needs 6MW of standard modular power infrastructure at an existing mining site, power already energized.",
      expectedOutcome: "Standard config delivered on schedule with no rework.",
      tags: ["Revenue"],
      createdAt: "2026-06-02T12:00:00.000Z",
      updatedAt: now,
    },
    {
      id: "p-0431",
      projectCode: "GE-2026-0431",
      customerId: "c-cedar",
      siteName: "Waco, TX",
      dealName: "~25MW exploratory",
      stage: "intake",
      status: "active",
      quotedRevenue: 0,
      currency: "USD",
      customerRequestedDeliveryDate: "2027-12-31",
      commercialOwnerId: whitfield,
      opsOwnerId: eng,
      quoteFrozenAt: null,
      bomLocked: false,
      requestorName: "T. Whitfield",
      requestorTeam: "Sales — Enterprise",
      problemStatement:
        "Customer exploring a ~25MW data center but has not finalized their own capacity plan or timeline.",
      expectedOutcome: "Firm spec and delivery target established before this moves to engineering.",
      tags: ["Other"],
      createdAt: "2026-09-01T12:00:00.000Z",
      updatedAt: now,
    },
    {
      id: "p-0422",
      projectCode: "GE-2026-0422",
      customerId: "c-lakeside",
      siteName: "Austin vs Round Rock, TX",
      dealName: "Colo block — HubSpot vs NetSuite mismatch",
      stage: "intake",
      status: "active",
      quotedRevenue: 4_800_000,
      currency: "USD",
      customerRequestedDeliveryDate: "2026-12-15",
      commercialOwnerId: cole,
      opsOwnerId: eng,
      quoteFrozenAt: null,
      bomLocked: false,
      requestorName: "R. Cole",
      requestorTeam: "Sales — Enterprise",
      problemStatement:
        "Lakeside is in HubSpot as an 8 MW / $4.8M closed-won colo deal. NetSuite has a 5 MW / $3.2M sales order for Phase 1 only. Engineering cannot freeze a BOM until CRM and ERP agree on load, price, site, and what “closed” means.",
      expectedOutcome:
        "One system of record: HubSpot opportunity and NetSuite SO-10491 reconciled, then spec freeze on the agreed Phase 1 scope.",
      tags: ["Revenue", "HubSpot", "NetSuite"],
      createdAt: "2026-08-28T12:00:00.000Z",
      updatedAt: now,
    },
  ];

  const specFields: SpecField[] = [
    ...fieldsFor("p-0417", {
      voltage: confirmed("13.8 kV primary / 480V secondary", cole),
      load: confirmed("18 MW critical IT load", cole),
      phase: confirmed("3-phase", cole),
      coolingType: {
        value: "",
        status: "conflicting",
        ownerId: eng,
        conflict: "Sales quoted Giga Box Air; customer site survey suggests Hydro needed for density.",
      },
      spaceConstraints: confirmed("40x60 ft pad, no basement", cole),
      requestedDelivery: confirmed("Q1 2027", cole),
      customerPowerReady: {
        value: "",
        status: "unresolved",
        ownerId: null,
        conflict: "Interconnection application status unknown — not yet confirmed with customer.",
      },
      deliveryDefinition: confirmed("Install complete (not energized)", contracts, "Contracts"),
      revenue_impact: confirmed("High — $3.1M quoted, anchor account for AI vertical expansion", cole),
      audit_revrec_risk: confirmed(
        "Elevated — milestone billing tied to customer energization, which Giga doesn't control",
        contracts,
        "Contracts"
      ),
      customer_impact: confirmed("Strategic — first AI colocation reference account", cole),
      complexity: confirmed("Custom — cooling type unresolved, non-standard site pad", eng, "Engineering"),
      cross_functional_effort: confirmed("High — sales, engineering, procurement, contracts all active", cole),
      timeline_pressure: confirmed(
        "High — 34-week transformer lead time leaves little slack against Q1 2027",
        cole
      ),
      control_impact: confirmed(
        "Revenue recognition — confirm whether billing milestone is install-complete or energization",
        contracts,
        "Contracts"
      ),
      downstream_dependencies: confirmed("FP&A (revenue timing), Audit (milestone billing terms)", contracts, "Contracts"),
    }),
    ...fieldsFor("p-0398", {
      voltage: confirmed("34.5 kV primary / 480V secondary", alvarez),
      load: confirmed("6 MW", alvarez),
      phase: confirmed("3-phase", alvarez),
      coolingType: confirmed("Giga Box Air", eng, "Engineering"),
      spaceConstraints: confirmed("Open lot, no restrictions", alvarez),
      requestedDelivery: confirmed("Nov 2026", alvarez),
      customerPowerReady: confirmed("Interconnection approved, energized Aug 2026", alvarez, "Customer"),
      deliveryDefinition: confirmed("Install complete (not energized)", contracts, "Contracts"),
      revenue_impact: confirmed("Moderate — $1.1M quoted, repeat customer", alvarez),
      audit_revrec_risk: confirmed("Low — customer power already energized, standard install-complete billing", contracts),
      customer_impact: confirmed("Standard — repeat account, low relationship risk", alvarez),
      complexity: confirmed("Standard — existing config, no site constraints", eng),
      cross_functional_effort: confirmed("Low — spec confirmed at intake, minimal handoff friction", alvarez),
      timeline_pressure: confirmed("Low — lead times comfortably within requested delivery", alvarez),
      control_impact: confirmed("None flagged — standard billing terms", contracts),
      downstream_dependencies: confirmed("None flagged", contracts),
    }),
    ...fieldsFor("p-0431", {
      load: {
        value: "~25 MW (rough estimate)",
        status: "unresolved",
        ownerId: whitfield,
        conflict: "Customer has not finalized their own capacity plan.",
      },
      requestedDelivery: {
        value: '"As soon as possible"',
        status: "conflicting",
        ownerId: whitfield,
        conflict: "No firm date — needs to be converted to a real target before engineering can scope.",
      },
      revenue_impact: { value: "Unknown — deal size not yet confirmed", status: "unresolved", ownerId: whitfield },
      audit_revrec_risk: { value: "Unknown — too early to assess billing structure", status: "unresolved", ownerId: null },
      customer_impact: { value: "Unknown — new logo, relationship still forming", status: "unresolved", ownerId: whitfield },
      complexity: { value: "Unknown — pending spec resolution", status: "unresolved", ownerId: null },
      cross_functional_effort: { value: "Unknown — nothing to hand off yet", status: "unresolved", ownerId: null },
      timeline_pressure: { value: "Unclear — customer has given no firm date", status: "unresolved", ownerId: whitfield },
      control_impact: { value: "Not yet assessable", status: "unresolved", ownerId: null },
      downstream_dependencies: { value: "None yet — too early in lifecycle", status: "unresolved", ownerId: null },
    }),
    ...fieldsFor("p-0422", {
      voltage: confirmed("13.8 kV primary / 480V secondary", cole, "HubSpot + NetSuite (agree)"),
      load: {
        value: "HubSpot 8 MW vs NetSuite 5 MW — not reconciled",
        status: "conflicting",
        ownerId: cole,
        source: "HubSpot vs NetSuite",
        conflict:
          "HubSpot opportunity GE-0422: 8 MW critical IT, $4.8M amount. NetSuite sales order SO-10491: 5 MW Phase 1, $3.2M. Expansion MW was stored as committed load in CRM, not as an option on the SO.",
      },
      phase: confirmed("3-phase", cole, "HubSpot + NetSuite (agree)"),
      coolingType: confirmed("Giga Box Air, liquid-ready", eng, "Engineering"),
      spaceConstraints: {
        value: "HubSpot Austin Metro vs NetSuite ship-to Round Rock",
        status: "conflicting",
        ownerId: cole,
        source: "HubSpot vs NetSuite",
        conflict:
          "HubSpot company/site = Austin Metro campus. NetSuite customer ship-to = Round Rock pad (Lakeside Inference Holdings LLC). Different legal entity and pad dimensions; enclosure BOM cannot be issued.",
      },
      requestedDelivery: {
        value: "HubSpot 15 Dec 2026 vs NetSuite 31 Mar 2027",
        status: "conflicting",
        ownerId: cole,
        source: "HubSpot vs NetSuite",
        conflict:
          "HubSpot close date / customer requested delivery = 2026-12-15. NetSuite promised ship on SO-10491 = 2027-03-31. Transformer lead time was never pushed back in CRM.",
      },
      customerPowerReady: {
        value: "",
        status: "unresolved",
        ownerId: singh,
        source: "NetSuite",
        conflict:
          "NetSuite has no interconnect milestone. HubSpot custom field “Power ready” is blank. Neither system is source of truth.",
      },
      deliveryDefinition: {
        value: "HubSpot closed-won ≠ NetSuite revenue event",
        status: "conflicting",
        ownerId: singh,
        source: "HubSpot vs NetSuite",
        conflict:
          "HubSpot marks the deal Closed Won at contract signature. NetSuite recognizes revenue on item fulfill / invoice. FP&A is forecasting HubSpot $4.8M in Q4; backlog in NetSuite is $3.2M in Q1 2027.",
      },
      revenue_impact: {
        value: "$4.8M HubSpot vs $3.2M NetSuite SO — $1.6M unexplained",
        status: "conflicting",
        ownerId: singh,
        source: "HubSpot vs NetSuite",
        conflict:
          "Pipeline and bookings do not match. Do not freeze quote or issue POs until amount and MW are one number.",
      },
      audit_revrec_risk: confirmed(
        "Elevated — CRM closed-won does not equal ERP booking. Dual amounts and dual dates will fail revenue cutoff testing.",
        singh,
        "NetSuite / Audit"
      ),
      customer_impact: confirmed(
        "Customer believes 8 MW is committed (HubSpot quote PDF). NetSuite SO they countersigned is 5 MW Phase 1 with an unpriced expansion rider.",
        cole,
        "HubSpot"
      ),
      complexity: confirmed("Custom — not technical complexity; master-data conflict between CRM and ERP", singh),
      cross_functional_effort: confirmed("High — Sales, RevOps, NetSuite admin, Contracts, FP&A, Audit", singh),
      timeline_pressure: confirmed(
        "High — HubSpot date is inside transformer lead time if 8 MW is real; NetSuite date is not",
        cole
      ),
      control_impact: confirmed(
        "HubSpot is not the revenue subledger. NetSuite SO is the booking record. Spec intake must stop treating CRM amount as confirmed commercial terms.",
        singh,
        "Controls"
      ),
      downstream_dependencies: confirmed(
        "FP&A (forecast uses HubSpot), Audit (cutoff), Procurement (MW sizes the transformer), Collections (AR will invoice NetSuite amount)",
        singh,
        "Controls"
      ),
    }),
  ];

  specFields.find((f) => f.id === "p-0417-customerPowerReady")!.conflictSummary =
    "Interconnection application status unknown — not yet confirmed with customer.";
  specFields.find((f) => f.id === "p-0431-load")!.conflictSummary =
    "Customer has not finalized their own capacity plan.";

  const quoteSnapshots: QuoteSnapshot[] = [
    {
      id: "q-0417-v1",
      projectId: "p-0417",
      version: 1,
      frozenAt: "2026-08-01T00:00:00.000Z",
      materials: 2_400_000,
      labor: 420_000,
      engineering: 180_000,
      freight: 95_000,
      note: "Baseline quote at spec handoff",
    },
    {
      id: "q-0398-v1",
      projectId: "p-0398",
      version: 1,
      frozenAt: "2026-06-15T00:00:00.000Z",
      materials: 890_000,
      labor: 140_000,
      engineering: 60_000,
      freight: 40_000,
      note: "Standard config freeze",
    },
  ];

  const suppliers: Supplier[] = [
    { id: "s-voltcore", name: "Voltcore Industries", typicalLeadTimeDays: 238, terms: "Net 45" },
    { id: "s-meridian", name: "Meridian Switchgear Co.", typicalLeadTimeDays: 112, terms: "Net 30" },
    { id: "s-lonestar", name: "Lonestar Fabrication", typicalLeadTimeDays: 56, terms: "Net 30" },
    { id: "s-inhouse", name: "In-house manufacturing", typicalLeadTimeDays: 42, terms: "internal" },
  ];

  const bomItems: BomItem[] = [
    {
      id: "bom-0417-xfmr",
      projectId: "p-0417",
      specFieldId: "p-0417-load",
      dependsOnFieldKey: "load",
      sku: "XFMR-18MW",
      description: "Primary transformer — 18MW rated",
      costCategory: "materials",
      qty: 1,
      uom: "ea",
      unitQuotedCost: 1_400_000,
    },
    {
      id: "bom-0417-swg",
      projectId: "p-0417",
      specFieldId: "p-0417-voltage",
      dependsOnFieldKey: "voltage",
      sku: "SWG-UL891",
      description: "Switchgear — UL 891 rated",
      costCategory: "materials",
      qty: 1,
      uom: "ea",
      unitQuotedCost: 250_000,
    },
    {
      id: "bom-0417-cool",
      projectId: "p-0417",
      specFieldId: "p-0417-coolingType",
      dependsOnFieldKey: "coolingType",
      sku: "COOL-PENDING",
      description: "Cooling units — spec pending (Air vs Hydro)",
      costCategory: "materials",
      qty: 1,
      uom: "ea",
      unitQuotedCost: 0,
    },
    {
      id: "bom-0417-enc",
      projectId: "p-0417",
      specFieldId: "p-0417-spaceConstraints",
      dependsOnFieldKey: "spaceConstraints",
      sku: "ENC-WP",
      description: "Enclosures / weatherproofing",
      costCategory: "materials",
      qty: 1,
      uom: "lot",
      unitQuotedCost: 0,
    },
    {
      id: "bom-0398-xfmr",
      projectId: "p-0398",
      specFieldId: "p-0398-load",
      dependsOnFieldKey: "load",
      sku: "XFMR-PAD-2",
      description: "Padmount transformers x2",
      costCategory: "materials",
      qty: 2,
      uom: "ea",
      unitQuotedCost: 320_000,
    },
    {
      id: "bom-0398-swb",
      projectId: "p-0398",
      specFieldId: "p-0398-voltage",
      dependsOnFieldKey: "voltage",
      sku: "SWB-ASM",
      description: "Switchboard assembly",
      costCategory: "materials",
      qty: 1,
      uom: "ea",
      unitQuotedCost: 220_000,
    },
    {
      id: "bom-0398-cool",
      projectId: "p-0398",
      specFieldId: "p-0398-coolingType",
      dependsOnFieldKey: "coolingType",
      sku: "GIGA-BOX-AIR",
      description: "Giga Box Air cooling unit",
      costCategory: "materials",
      qty: 1,
      uom: "ea",
      unitQuotedCost: 0,
    },
  ];

  const purchaseOrders: PurchaseOrder[] = [
    {
      id: "po-88214",
      poNumber: "PO-88214",
      projectId: "p-0417",
      supplierId: "s-voltcore",
      documentType: "po",
      status: "confirmed",
      issuedAt: "2026-08-14",
      leadTimeDays: 238,
      promisedShipDate: "2027-01-15",
      totalAmount: 1_400_000,
      notes: "Transformer bank — primary order",
    },
    {
      id: "po-88231",
      poNumber: "PO-88231",
      projectId: "p-0417",
      supplierId: "s-meridian",
      documentType: "po",
      status: "confirmed",
      issuedAt: "2026-08-22",
      leadTimeDays: 112,
      promisedShipDate: "2027-02-20",
      totalAmount: 250_000,
      notes: "Switchgear — UL 891",
    },
    {
      id: "po-88240",
      poNumber: "PO-88240",
      projectId: "p-0417",
      supplierId: "s-lonestar",
      documentType: "po",
      status: "ordered",
      issuedAt: "2026-09-01",
      leadTimeDays: 56,
      promisedShipDate: "2027-01-10",
      totalAmount: 0,
      notes: "Enclosures / weatherproofing",
    },
    {
      id: "po-87902",
      poNumber: "PO-87902",
      projectId: "p-0398",
      supplierId: "s-voltcore",
      documentType: "po",
      status: "received",
      issuedAt: "2026-07-02",
      leadTimeDays: 84,
      promisedShipDate: "2026-08-10",
      totalAmount: 640_000,
      notes: "Padmount transformers x2",
    },
    {
      id: "po-87910",
      poNumber: "PO-87910",
      projectId: "p-0398",
      supplierId: "s-meridian",
      documentType: "po",
      status: "shipped",
      issuedAt: "2026-07-10",
      leadTimeDays: 70,
      promisedShipDate: "2026-09-25",
      totalAmount: 220_000,
      notes: "Switchboard assembly",
    },
    {
      id: "wo-4471",
      poNumber: "WO-4471",
      projectId: "p-0398",
      supplierId: "s-inhouse",
      documentType: "wo",
      status: "in_production",
      issuedAt: "2026-08-01",
      leadTimeDays: 42,
      promisedShipDate: "2026-09-20",
      totalAmount: 0,
      notes: "Giga Box Air cooling unit",
    },
    {
      id: "po-0398-frt",
      poNumber: "PO-87922",
      projectId: "p-0398",
      supplierId: "s-lonestar",
      documentType: "po",
      status: "received",
      issuedAt: "2026-07-12",
      leadTimeDays: 14,
      promisedShipDate: "2026-08-01",
      totalAmount: 38_000,
      notes: "Freight / logistics",
    },
    {
      id: "po-0398-eng",
      poNumber: "PO-87918",
      projectId: "p-0398",
      supplierId: "s-inhouse",
      documentType: "wo",
      status: "received",
      issuedAt: "2026-06-20",
      leadTimeDays: 20,
      promisedShipDate: "2026-07-15",
      totalAmount: 58_000,
      notes: "Engineering package",
    },
  ];

  const poLines: PoLine[] = [
    { id: "pl-88214", poId: "po-88214", projectId: "p-0417", bomItemId: "bom-0417-xfmr", description: "Primary transformer", qty: 1, unitCost: 1_400_000, costCategory: "materials" },
    { id: "pl-88231", poId: "po-88231", projectId: "p-0417", bomItemId: "bom-0417-swg", description: "Switchgear UL 891", qty: 1, unitCost: 250_000, costCategory: "materials" },
    { id: "pl-88240", poId: "po-88240", projectId: "p-0417", bomItemId: "bom-0417-enc", description: "Enclosures", qty: 1, unitCost: 0, costCategory: "materials" },
    { id: "pl-87902", poId: "po-87902", projectId: "p-0398", bomItemId: "bom-0398-xfmr", description: "Padmount transformers", qty: 2, unitCost: 320_000, costCategory: "materials" },
    { id: "pl-87910", poId: "po-87910", projectId: "p-0398", bomItemId: "bom-0398-swb", description: "Switchboard", qty: 1, unitCost: 220_000, costCategory: "materials" },
    { id: "pl-4471", poId: "wo-4471", projectId: "p-0398", bomItemId: "bom-0398-cool", description: "Giga Box Air", qty: 1, unitCost: 0, costCategory: "materials" },
    { id: "pl-87922", poId: "po-0398-frt", projectId: "p-0398", bomItemId: null, description: "Freight", qty: 1, unitCost: 38_000, costCategory: "freight" },
    { id: "pl-87918", poId: "po-0398-eng", projectId: "p-0398", bomItemId: null, description: "Engineering", qty: 1, unitCost: 58_000, costCategory: "engineering" },
  ];

  const laborEntries: LaborEntry[] = [
    { id: "lb-0417-a", projectId: "p-0417", committedAt: "2026-09-05", role: "Field engineering", hours: 260, rate: 250, amount: 65_000, costCategory: "labor", notes: "Field engineering — site survey" },
    { id: "lb-0417-b", projectId: "p-0417", committedAt: "2026-08-20", role: "Install crew", hours: 100, rate: 250, amount: 25_000, costCategory: "labor", notes: "Crew hold for Q1 pad" },
    { id: "lb-0417-e", projectId: "p-0417", committedAt: "2026-08-10", role: "Applications engineering", hours: 400, rate: 350, amount: 140_000, costCategory: "engineering", notes: "Spec package + cooling conflict revisions" },
    { id: "lb-0398-a", projectId: "p-0398", committedAt: "2026-09-01", role: "Install crew", hours: 220, rate: 250, amount: 55_000, costCategory: "labor", notes: "Install crew — week 1" },
    { id: "lb-0398-b", projectId: "p-0398", committedAt: "2026-08-15", role: "Install crew", hours: 220, rate: 250, amount: 55_000, costCategory: "labor", notes: "Install crew — week 2 hold" },
  ];

  const supplierInvoices: SupplierInvoice[] = [
    { id: "si-0417-e", projectId: "p-0417", poId: null, invoiceNumber: "ENG-8829", invoicedAt: "2026-08-29", paidAt: null, amount: 40_000, costCategory: "engineering", status: "invoiced" },
    { id: "si-0417-e2", projectId: "p-0417", poId: null, invoiceNumber: "ENG-8840", invoicedAt: "2026-09-10", paidAt: "2026-09-12", amount: 100_000, costCategory: "engineering", status: "paid" },
    { id: "si-0417-l", projectId: "p-0417", poId: null, invoiceNumber: "LAB-0905", invoicedAt: "2026-09-05", paidAt: "2026-09-08", amount: 65_000, costCategory: "labor", status: "paid" },
    { id: "si-0417-m", projectId: "p-0417", poId: "po-88214", invoiceNumber: "VC-1102", invoicedAt: "2026-09-01", paidAt: null, amount: 610_000, costCategory: "materials", status: "invoiced" },
    { id: "si-0398-m", projectId: "p-0398", poId: "po-87902", invoiceNumber: "VC-0881", invoicedAt: "2026-08-18", paidAt: "2026-08-20", amount: 640_000, costCategory: "materials", status: "paid" },
    { id: "si-0398-m2", projectId: "p-0398", poId: "po-87910", invoiceNumber: "MD-2210", invoicedAt: "2026-09-12", paidAt: null, amount: 220_000, costCategory: "materials", status: "invoiced" },
    { id: "si-0398-l", projectId: "p-0398", poId: null, invoiceNumber: "LAB-0901", invoicedAt: "2026-09-01", paidAt: "2026-09-03", amount: 95_000, costCategory: "labor", status: "paid" },
    { id: "si-0398-e", projectId: "p-0398", poId: "po-0398-eng", invoiceNumber: "ENG-0398", invoicedAt: "2026-07-20", paidAt: "2026-07-22", amount: 58_000, costCategory: "engineering", status: "paid" },
    { id: "si-0398-f", projectId: "p-0398", poId: "po-0398-frt", invoiceNumber: "FRT-0398", invoicedAt: "2026-08-02", paidAt: "2026-08-05", amount: 38_000, costCategory: "freight", status: "paid" },
  ];

  const customerInvoices: CustomerInvoice[] = [];
  const arPayments: ArPayment[] = [];

  return {
    users,
    customers,
    projects,
    specFields,
    quoteSnapshots,
    bomItems,
    suppliers,
    purchaseOrders,
    poLines,
    laborEntries,
    supplierInvoices,
    customerInvoices,
    arPayments,
    costPins: {},
    arPins: {},
  };
}
