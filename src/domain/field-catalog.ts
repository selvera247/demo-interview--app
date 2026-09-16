import type { SpecSection } from "./types";

export interface FieldCatalogEntry {
  fieldKey: string;
  section: SpecSection;
  label: string;
  unit: string | null;
  required: boolean;
}

export const FIELD_CATALOG: FieldCatalogEntry[] = [
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

export const SYSTEMS_FIELD_KEYS = FIELD_CATALOG.filter((entry) => entry.section === "systems").map(
  (entry) => entry.fieldKey
);

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
