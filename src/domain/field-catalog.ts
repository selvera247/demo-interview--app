import type { IntakeTemplate, SpecSection } from "./types";

export interface FieldCatalogEntry {
  fieldKey: string;
  section: SpecSection;
  label: string;
  unit: string | null;
  required: boolean;
}

/** Commercial energy / deal catalog (default). */
export const COMMERCIAL_FIELD_CATALOG: FieldCatalogEntry[] = [
  { fieldKey: "voltage", section: "systems", label: "Voltage", unit: null, required: true },
  { fieldKey: "load", section: "systems", label: "Load", unit: null, required: true },
  { fieldKey: "phase", section: "systems", label: "Phase configuration", unit: null, required: true },
  { fieldKey: "coolingType", section: "systems", label: "Cooling type", unit: null, required: true },
  { fieldKey: "spaceConstraints", section: "systems", label: "Site / space constraints", unit: null, required: true },
  { fieldKey: "requestedDelivery", section: "systems", label: "Requested delivery", unit: null, required: true },
  { fieldKey: "customerPowerReady", section: "systems", label: "Customer power / interconnection status", unit: null, required: true },
  { fieldKey: "deliveryDefinition", section: "systems", label: "Definition of \"delivery\"", unit: null, required: true },
  { fieldKey: "revenue_impact", section: "business_impact", label: "Revenue impact", unit: null, required: true },
  { fieldKey: "audit_revrec_risk", section: "business_impact", label: "Audit risk", unit: null, required: true },
  { fieldKey: "customer_impact", section: "business_impact", label: "Customer impact", unit: null, required: true },
  { fieldKey: "complexity", section: "effort_timing", label: "Complexity", unit: null, required: false },
  { fieldKey: "cross_functional_effort", section: "effort_timing", label: "Cross-functional effort", unit: null, required: false },
  { fieldKey: "timeline_pressure", section: "effort_timing", label: "Timeline pressure", unit: null, required: false },
  { fieldKey: "control_impact", section: "controls", label: "Control impact", unit: null, required: true },
  { fieldKey: "downstream_dependencies", section: "controls", label: "Downstream dependencies", unit: null, required: true },
];

/**
 * OCFO finance catalog — same section spine, finance-oriented systems fields.
 * Supports close/flux, O2C disputes/cash app, and P2P invoice exceptions.
 */
export const OCFO_FIELD_CATALOG: FieldCatalogEntry[] = [
  { fieldKey: "workflow_lane", section: "systems", label: "Workflow lane", unit: null, required: true },
  { fieldKey: "close_period", section: "systems", label: "Period / cycle", unit: null, required: true },
  { fieldKey: "entity_scope", section: "systems", label: "Entity scope", unit: null, required: true },
  { fieldKey: "focal_object", section: "systems", label: "Account / invoice / PO", unit: null, required: true },
  { fieldKey: "exception_summary", section: "systems", label: "Variance or exception summary", unit: null, required: true },
  { fieldKey: "proposed_treatment", section: "systems", label: "Proposed treatment", unit: null, required: true },
  { fieldKey: "evidence_refs", section: "systems", label: "Evidence / citation IDs", unit: null, required: true },
  { fieldKey: "materiality", section: "systems", label: "Materiality / threshold", unit: null, required: true },
  { fieldKey: "revenue_impact", section: "business_impact", label: "Quantified finance impact", unit: null, required: true },
  { fieldKey: "audit_revrec_risk", section: "business_impact", label: "Control / audit risk", unit: null, required: true },
  { fieldKey: "customer_impact", section: "business_impact", label: "Stakeholder / process impact", unit: null, required: true },
  { fieldKey: "complexity", section: "effort_timing", label: "Complexity", unit: null, required: false },
  { fieldKey: "cross_functional_effort", section: "effort_timing", label: "Cross-functional effort", unit: null, required: false },
  { fieldKey: "timeline_pressure", section: "effort_timing", label: "Timeline pressure", unit: null, required: false },
  { fieldKey: "control_impact", section: "controls", label: "Control impact", unit: null, required: true },
  { fieldKey: "downstream_dependencies", section: "controls", label: "Downstream effect", unit: null, required: true },
];

/** @deprecated Prefer getFieldCatalog("commercial") — kept as the default commercial catalog. */
export const FIELD_CATALOG: FieldCatalogEntry[] = COMMERCIAL_FIELD_CATALOG;

export function getFieldCatalog(template: IntakeTemplate = "commercial"): FieldCatalogEntry[] {
  return template === "ocfo" ? OCFO_FIELD_CATALOG : COMMERCIAL_FIELD_CATALOG;
}

/**
 * Keys collected with value + status + owner + note at intake.
 * Commercial: systems section only. OCFO: full finance catalog.
 */
export function structuredFieldKeys(template: IntakeTemplate = "commercial"): string[] {
  const catalog = getFieldCatalog(template);
  if (template === "ocfo") return catalog.map((entry) => entry.fieldKey);
  return catalog.filter((entry) => entry.section === "systems").map((entry) => entry.fieldKey);
}

export function catalogKeysForSection(
  template: IntakeTemplate,
  section: SpecSection
): FieldCatalogEntry[] {
  return getFieldCatalog(template).filter((entry) => entry.section === section);
}

export function fieldLabelMap(template: IntakeTemplate = "commercial"): Record<string, string> {
  return Object.fromEntries(getFieldCatalog(template).map((entry) => [entry.fieldKey, entry.label]));
}

export const SYSTEMS_FIELD_KEYS = structuredFieldKeys("commercial");

export const SPEC_SECTION_ORDER: SpecSection[] = [
  "business_impact",
  "systems",
  "effort_timing",
  "controls",
];

export const SPEC_SECTION_LABEL: Record<SpecSection, string> = {
  business_impact: "Business Impact",
  systems: "Systems & Data",
  effort_timing: "Effort & Timing",
  controls: "Controls & Dependencies",
};

export const OCFO_SECTION_LABEL: Record<SpecSection, string> = {
  business_impact: "Finance Impact",
  systems: "Close / O2C / P2P Data",
  effort_timing: "Effort & Timing",
  controls: "Controls & Dependencies",
};

export function sectionLabel(template: IntakeTemplate, section: SpecSection): string {
  return template === "ocfo" ? OCFO_SECTION_LABEL[section] : SPEC_SECTION_LABEL[section];
}
