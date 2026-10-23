import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  catalogKeysForSection,
  getFieldCatalog,
  sectionLabel,
} from "../src/domain/field-catalog";
import type { FieldStatus, IntakeTemplate, SpecSection } from "../src/domain/types";
import {
  emptyStructuredIntake,
  type IntakeSystemField,
  type NewDealIntake,
} from "../src/data/create-deal";

const inputClass =
  "w-full rounded-md border border-[#3a3d44] bg-[#1C1E22] px-3 py-2 text-[13px] text-[#E8E6E1] placeholder:text-[#6b7077] focus:outline-none focus:border-[#C9762E]/70";
const labelClass = "text-[11px] text-[#8B9099] mb-1 block";

function SpecSectionBlock({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#C9762E] text-[11px] font-semibold text-[#1C1E22] shrink-0">
          {number}
        </span>
        <span className="text-[13px] font-semibold tracking-tight">{title}</span>
      </div>
      <div className="pl-[30px] space-y-3">{children}</div>
    </div>
  );
}

function StructuredFieldCard({
  label,
  field,
  onPatch,
}: {
  label: string;
  field: IntakeSystemField;
  onPatch: (patch: Partial<IntakeSystemField>) => void;
}) {
  return (
    <div className="rounded-md border border-[#2a2d33] bg-[#212327] px-3.5 py-3 space-y-2">
      <div className="text-[12px] font-medium">{label}</div>
      <textarea
        className={inputClass}
        rows={2}
        value={field.value}
        onChange={(e) => onPatch({ value: e.target.value })}
        placeholder="Value, or leave blank if unresolved"
      />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={labelClass}>Status</label>
          <select
            className={inputClass}
            value={field.status}
            onChange={(e) => onPatch({ status: e.target.value as FieldStatus })}
          >
            <option value="unresolved">Unresolved</option>
            <option value="conflicting">Conflicting</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Owner</label>
          <input
            className={inputClass}
            value={field.ownerName}
            onChange={(e) => onPatch({ ownerName: e.target.value })}
            placeholder="Required to confirm"
          />
        </div>
        <div>
          <label className={labelClass}>Note / conflict</label>
          <input
            className={inputClass}
            value={field.note}
            onChange={(e) => onPatch({ note: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

const OCFO_SECTION_ORDER: SpecSection[] = [
  "systems",
  "business_impact",
  "effort_timing",
  "controls",
];

export default function NewDealPanel({
  nextCode,
  onClose,
  onSave,
}: {
  nextCode: string;
  onClose: () => void;
  onSave: (intake: NewDealIntake) => void;
}) {
  const [template, setTemplate] = useState<IntakeTemplate>("commercial");
  const [customerName, setCustomerName] = useState("");
  const [site, setSite] = useState("");
  const [dealName, setDealName] = useState("");
  const [requestName, setRequestName] = useState("");
  const [cycle, setCycle] = useState("");
  const [entity, setEntity] = useState("");
  const [requestCode, setRequestCode] = useState("");
  const [impactType, setImpactType] = useState("");
  const [quantifiedImpact, setQuantifiedImpact] = useState("");
  const [controlRisk, setControlRisk] = useState("");
  const [downstreamEffect, setDownstreamEffect] = useState("");
  const [requestorName, setRequestorName] = useState("");
  const [requestorTeam, setRequestorTeam] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [revenueImpact, setRevenueImpact] = useState("");
  const [auditRisk, setAuditRisk] = useState("");
  const [customerImpact, setCustomerImpact] = useState("");
  const [complexity, setComplexity] = useState("");
  const [crossFunctionalEffort, setCrossFunctionalEffort] = useState("");
  const [timelinePressure, setTimelinePressure] = useState("");
  const [controlImpact, setControlImpact] = useState("");
  const [downstreamDependencies, setDownstreamDependencies] = useState("");
  const [tags, setTags] = useState("");
  const [systems, setSystems] = useState(() => emptyStructuredIntake("commercial"));
  const [error, setError] = useState("");

  const catalog = useMemo(() => getFieldCatalog(template), [template]);

  function switchTemplate(next: IntakeTemplate) {
    setTemplate(next);
    setSystems(emptyStructuredIntake(next));
    setError("");
  }

  function patchSystem(key: string, patch: Partial<IntakeSystemField>) {
    setSystems((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!customerName.trim()) {
      setError(
        template === "ocfo"
          ? "Organization / entity name is required to open a finance request."
          : "Customer name is required to open a deal record."
      );
      return;
    }
    onSave({
      template,
      customerName,
      site,
      dealName,
      requestName,
      cycle,
      entity,
      requestCode,
      impactType,
      quantifiedImpact,
      controlRisk,
      downstreamEffect,
      requestorName,
      requestorTeam,
      problemStatement,
      expectedOutcome,
      tags,
      revenueImpact,
      auditRisk,
      customerImpact,
      complexity,
      crossFunctionalEffort,
      timelinePressure,
      controlImpact,
      downstreamDependencies,
      systems,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 py-8 overflow-y-auto">
      <form
        onSubmit={submit}
        className="w-full max-w-[760px] rounded-lg border border-[#33363c] bg-[#1C1E22] text-[#E8E6E1] shadow-none"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#33363c] bg-[#1C1E22] px-6 py-4">
          <div>
            <div className="text-[12px] text-[#8B9099]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              {nextCode}
            </div>
            <div className="text-[15px] font-semibold tracking-tight">New spec intake</div>
            <div className="text-[12px] text-[#8B9099]">
              {template === "ocfo"
                ? "OCFO finance request — close, O2C, or P2P. Ambiguity can stay unresolved."
                : "Populate the customer requirement record. Ambiguity can stay unresolved."}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-[#8B9099] hover:text-[#E8E6E1]" aria-label="Close intake">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[12px] text-amber-400">
              {error}
            </div>
          )}

          <SpecSectionBlock number="0" title="Template">
            <div className="flex gap-2" role="radiogroup" aria-label="Intake template">
              {(
                [
                  ["commercial", "Commercial"],
                  ["ocfo", "OCFO"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={template === value}
                  onClick={() => switchTemplate(value)}
                  className={`px-3 py-1.5 rounded-md border text-[12px] font-medium transition-colors ${
                    template === value
                      ? "border-[#C9762E]/60 bg-[#C9762E]/15 text-[#E8E6E1]"
                      : "border-[#3a3d44] bg-[#212327] text-[#8B9099] hover:text-[#E8E6E1]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#8B9099]">
              Commercial is the default energy/deal intake. OCFO switches the field catalog for finance workflows.
            </p>
          </SpecSectionBlock>

          <SpecSectionBlock number="1" title={template === "ocfo" ? "Request identity" : "Deal identity"}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="customerName">
                  {template === "ocfo" ? "Organization" : "Customer"}
                </label>
                <input
                  id="customerName"
                  className={inputClass}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={template === "ocfo" ? "e.g. Northwind Digital" : "e.g. Demo AI"}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="site">
                  {template === "ocfo" ? "Entity (display)" : "Site"}
                </label>
                <input
                  id="site"
                  className={inputClass}
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  placeholder={template === "ocfo" ? "e.g. ND-US" : "Campus / city"}
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="dealName">
                {template === "ocfo" ? "Request title" : "Deal name"}
              </label>
              <input
                id="dealName"
                className={inputClass}
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                placeholder={
                  template === "ocfo"
                    ? "e.g. Month-end close — Subscription Revenue flux"
                    : "e.g. Phase 1 — 2 MW wholesale colo"
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="requestName">
                  Request name
                </label>
                <input id="requestName" className={inputClass} value={requestName} onChange={(e) => setRequestName(e.target.value)} placeholder="Short name (optional)" />
              </div>
              <div>
                <label className={labelClass} htmlFor="requestCode">
                  Request code
                </label>
                <input id="requestCode" className={inputClass} value={requestCode} onChange={(e) => setRequestCode(e.target.value)} placeholder="Optional override" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="cycle">
                  Cycle
                </label>
                <input id="cycle" className={inputClass} value={cycle} onChange={(e) => setCycle(e.target.value)} placeholder={template === "ocfo" ? "e.g. 2026-06" : "Optional"} />
              </div>
              <div>
                <label className={labelClass} htmlFor="entity">
                  Entity
                </label>
                <input id="entity" className={inputClass} value={entity} onChange={(e) => setEntity(e.target.value)} placeholder={template === "ocfo" ? "e.g. ND-US" : "Optional"} />
              </div>
            </div>
            {template === "ocfo" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="impactType">
                    Impact type
                  </label>
                  <input
                    id="impactType"
                    className={inputClass}
                    value={impactType}
                    onChange={(e) => setImpactType(e.target.value)}
                    placeholder="Close / O2C dispute / P2P exception"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="quantifiedImpact">
                    Quantified impact
                  </label>
                  <input
                    id="quantifiedImpact"
                    className={inputClass}
                    value={quantifiedImpact}
                    onChange={(e) => setQuantifiedImpact(e.target.value)}
                    placeholder="e.g. −$400k MoM"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="controlRisk">
                    Control risk
                  </label>
                  <input id="controlRisk" className={inputClass} value={controlRisk} onChange={(e) => setControlRisk(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="downstreamEffect">
                    Downstream effect
                  </label>
                  <input
                    id="downstreamEffect"
                    className={inputClass}
                    value={downstreamEffect}
                    onChange={(e) => setDownstreamEffect(e.target.value)}
                  />
                </div>
              </div>
            )}
          </SpecSectionBlock>

          <SpecSectionBlock number="2" title="Request Basics">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="requestorName">
                  Requestor
                </label>
                <input id="requestorName" className={inputClass} value={requestorName} onChange={(e) => setRequestorName(e.target.value)} placeholder="Name" />
              </div>
              <div>
                <label className={labelClass} htmlFor="requestorTeam">
                  Requestor team
                </label>
                <input
                  id="requestorTeam"
                  className={inputClass}
                  value={requestorTeam}
                  onChange={(e) => setRequestorTeam(e.target.value)}
                  placeholder={template === "ocfo" ? "OCFO — Controllership" : "Sales — Enterprise"}
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="problemStatement">
                Problem statement
              </label>
              <textarea id="problemStatement" rows={3} className={inputClass} value={problemStatement} onChange={(e) => setProblemStatement(e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="expectedOutcome">
                Expected outcome
              </label>
              <textarea id="expectedOutcome" rows={2} className={inputClass} value={expectedOutcome} onChange={(e) => setExpectedOutcome(e.target.value)} />
            </div>
          </SpecSectionBlock>

          {template === "commercial" ? (
            <>
              <SpecSectionBlock number="3" title="Business Impact">
                <div>
                  <label className={labelClass} htmlFor="revenueImpact">
                    Revenue impact
                  </label>
                  <textarea id="revenueImpact" rows={2} className={inputClass} value={revenueImpact} onChange={(e) => setRevenueImpact(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="auditRisk">
                    Audit risk
                  </label>
                  <textarea id="auditRisk" rows={2} className={inputClass} value={auditRisk} onChange={(e) => setAuditRisk(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="customerImpact">
                    Customer impact
                  </label>
                  <textarea id="customerImpact" rows={2} className={inputClass} value={customerImpact} onChange={(e) => setCustomerImpact(e.target.value)} />
                </div>
              </SpecSectionBlock>

              <SpecSectionBlock number="4" title="Systems & Data">
                {catalog
                  .filter((entry) => entry.section === "systems")
                  .map((entry) => (
                    <StructuredFieldCard
                      key={entry.fieldKey}
                      label={entry.label}
                      field={systems[entry.fieldKey] ?? { value: "", status: "unresolved", ownerName: "", note: "" }}
                      onPatch={(patch) => patchSystem(entry.fieldKey, patch)}
                    />
                  ))}
              </SpecSectionBlock>

              <SpecSectionBlock number="5" title="Effort & Timing">
                <div>
                  <label className={labelClass} htmlFor="complexity">
                    Complexity
                  </label>
                  <input id="complexity" className={inputClass} value={complexity} onChange={(e) => setComplexity(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="crossFunctionalEffort">
                    Cross-functional effort
                  </label>
                  <input id="crossFunctionalEffort" className={inputClass} value={crossFunctionalEffort} onChange={(e) => setCrossFunctionalEffort(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="timelinePressure">
                    Timeline pressure
                  </label>
                  <input id="timelinePressure" className={inputClass} value={timelinePressure} onChange={(e) => setTimelinePressure(e.target.value)} />
                </div>
              </SpecSectionBlock>

              <SpecSectionBlock number="6" title="Controls & Dependencies">
                <div>
                  <label className={labelClass} htmlFor="controlImpact">
                    Control impact
                  </label>
                  <textarea id="controlImpact" rows={2} className={inputClass} value={controlImpact} onChange={(e) => setControlImpact(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="downstreamDependencies">
                    Downstream dependencies
                  </label>
                  <textarea id="downstreamDependencies" rows={2} className={inputClass} value={downstreamDependencies} onChange={(e) => setDownstreamDependencies(e.target.value)} />
                </div>
              </SpecSectionBlock>
            </>
          ) : (
            OCFO_SECTION_ORDER.map((section, index) => (
              <SpecSectionBlock
                key={section}
                number={String(index + 3)}
                title={sectionLabel("ocfo", section)}
              >
                {section === "systems" && (
                  <p className="text-[11px] text-[#8B9099] -mt-1 mb-1">
                    Use workflow lane for Close / flux, O2C invoice dispute or cash app, or P2P invoice exception.
                  </p>
                )}
                {catalogKeysForSection("ocfo", section).map((entry) => (
                  <StructuredFieldCard
                    key={entry.fieldKey}
                    label={entry.label}
                    field={systems[entry.fieldKey] ?? { value: "", status: "unresolved", ownerName: "", note: "" }}
                    onPatch={(patch) => patchSystem(entry.fieldKey, patch)}
                  />
                ))}
              </SpecSectionBlock>
            ))
          )}

          <SpecSectionBlock number={template === "ocfo" ? "7" : "7"} title="Tags">
            <div>
              <label className={labelClass} htmlFor="tags">
                Tags (comma-separated)
              </label>
              <input
                id="tags"
                className={inputClass}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={template === "ocfo" ? "Close, Flux, O2C" : "Urgent, Revenue"}
              />
            </div>
          </SpecSectionBlock>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#33363c] px-6 py-4">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded text-[12px] text-[#8B9099] hover:text-[#E8E6E1]">
            Cancel
          </button>
          <button type="submit" className="px-3 py-1.5 rounded text-[12px] font-medium bg-[#C9762E] text-[#1C1E22]">
            {template === "ocfo" ? "Create finance request" : "Create deal record"}
          </button>
        </div>
      </form>
    </div>
  );
}
