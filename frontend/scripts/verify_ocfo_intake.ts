/**
 * Smoke-check Commercial + OCFO intake against the shared create-deal path.
 * Run: npx tsx frontend/scripts/verify_ocfo_intake.ts
 */
import {
  addDealFromIntake,
  emptyOcfoStructuredIntake,
  emptySystemsIntake,
} from "../../src/data/create-deal";
import { toDealView } from "../../src/data/deal-adapter";
import { createSeedState } from "../../src/data/seed";

const base = createSeedState();
const ocfoSeed = base.projects.find((p) => p.template === "ocfo");
if (!ocfoSeed) throw new Error("Missing OCFO seed project");
const ocfoView = toDealView(base, ocfoSeed);
if (ocfoView.template !== "ocfo") throw new Error("OCFO view template mismatch");
if (!ocfoView.fields.workflow_lane) throw new Error("OCFO view missing workflow_lane");

const commercial = addDealFromIntake(
  base,
  {
    template: "commercial",
    customerName: "Verify Colo",
    site: "Austin",
    dealName: "Verify commercial",
    requestName: "",
    cycle: "",
    entity: "",
    requestCode: "",
    impactType: "",
    quantifiedImpact: "",
    controlRisk: "",
    downstreamEffect: "",
    requestorName: "R. Cole",
    requestorTeam: "Sales",
    problemStatement: "Smoke",
    expectedOutcome: "Ok",
    tags: "Smoke",
    revenueImpact: "Low",
    auditRisk: "Low",
    customerImpact: "Low",
    complexity: "Low",
    crossFunctionalEffort: "Low",
    timelinePressure: "Low",
    controlImpact: "None",
    downstreamDependencies: "None",
    systems: emptySystemsIntake(),
  },
  "2026-10-23T12:00:00.000Z"
);
const commercialProject = commercial.state.projects.find(
  (p) => p.projectCode === commercial.projectCode
);
if (!commercialProject || commercialProject.template !== "commercial") {
  throw new Error("Commercial intake did not persist template");
}

const finance = addDealFromIntake(
  commercial.state,
  {
    template: "ocfo",
    customerName: "Northwind Digital",
    site: "ND-EU",
    dealName: "O2C cash app exception",
    requestName: "Cash app — INV-991",
    cycle: "2026-09",
    entity: "ND-EU",
    requestCode: "FC-2026-0901",
    impactType: "O2C cash application",
    quantifiedImpact: "$120k unapplied",
    controlRisk: "Medium",
    downstreamEffect: "AR aging",
    requestorName: "K. Singh",
    requestorTeam: "OCFO",
    problemStatement: "Unapplied cash",
    expectedOutcome: "Match and clear",
    tags: "O2C, Cash app",
    revenueImpact: "",
    auditRisk: "",
    customerImpact: "",
    complexity: "",
    crossFunctionalEffort: "",
    timelinePressure: "",
    controlImpact: "",
    downstreamDependencies: "",
    systems: {
      ...emptyOcfoStructuredIntake(),
      workflow_lane: {
        value: "O2C — cash application",
        status: "confirmed",
        ownerName: "K. Singh",
        note: "",
      },
    },
  },
  "2026-10-23T12:05:00.000Z"
);
const financeProject = finance.state.projects.find((p) => p.projectCode === finance.projectCode);
if (!financeProject || financeProject.template !== "ocfo") {
  throw new Error("OCFO intake did not persist template");
}
if (financeProject.cycle !== "2026-09" || financeProject.entity !== "ND-EU") {
  throw new Error("OCFO metadata not persisted");
}
const financeFields = finance.state.specFields.filter((f) => f.projectId === financeProject.id);
if (!financeFields.some((f) => f.fieldKey === "workflow_lane" && f.value.includes("O2C"))) {
  throw new Error("OCFO structured field not persisted");
}

console.log("verify_ocfo_intake: ok");
