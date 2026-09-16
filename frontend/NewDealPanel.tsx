import { useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { FIELD_CATALOG } from "../src/domain/field-catalog";
import type { FieldStatus } from "../src/domain/types";
import {
  SYSTEMS_INTAKE_KEYS,
  emptySystemsIntake,
  type NewDealIntake,
  type SystemsIntakeKey,
} from "../src/data/create-deal";

const inputClass =
  "w-full rounded-md border border-[#3a3d44] bg-[#1C1E22] px-3 py-2 text-[13px] text-[#E8E6E1] placeholder:text-[#6b7077] focus:outline-none focus:border-[#C9762E]/70";
const labelClass = "text-[11px] text-[#8B9099] mb-1 block";

function SpecSection({
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

export default function NewDealPanel({
  nextCode,
  onClose,
  onSave,
}: {
  nextCode: string;
  onClose: () => void;
  onSave: (intake: NewDealIntake) => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [site, setSite] = useState("");
  const [dealName, setDealName] = useState("");
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
  const [systems, setSystems] = useState(emptySystemsIntake);
  const [error, setError] = useState("");

  function patchSystem(key: SystemsIntakeKey, patch: Partial<(typeof systems)[SystemsIntakeKey]>) {
    setSystems((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!customerName.trim()) {
      setError("Customer name is required to open a deal record.");
      return;
    }
    onSave({
      customerName,
      site,
      dealName,
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
            <div className="text-[12px] text-[#8B9099]">Populate the customer requirement record. Ambiguity can stay unresolved.</div>
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

          <SpecSection number="0" title="Deal identity">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="customerName">
                  Customer
                </label>
                <input id="customerName" className={inputClass} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Demo AI" />
              </div>
              <div>
                <label className={labelClass} htmlFor="site">
                  Site
                </label>
                <input id="site" className={inputClass} value={site} onChange={(e) => setSite(e.target.value)} placeholder="Campus / city" />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="dealName">
                Deal name
              </label>
              <input id="dealName" className={inputClass} value={dealName} onChange={(e) => setDealName(e.target.value)} placeholder="e.g. Phase 1 — 2 MW wholesale colo" />
            </div>
          </SpecSection>

          <SpecSection number="1" title="Request Basics">
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
                <input id="requestorTeam" className={inputClass} value={requestorTeam} onChange={(e) => setRequestorTeam(e.target.value)} placeholder="Sales — Enterprise" />
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
          </SpecSection>

          <SpecSection number="2" title="Business Impact">
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
          </SpecSection>

          <SpecSection number="3" title="Systems & Data">
            {SYSTEMS_INTAKE_KEYS.map((key) => {
              const field = systems[key];
              const label = FIELD_CATALOG.find((entry) => entry.fieldKey === key)?.label ?? key;
              return (
                <div key={key} className="rounded-md border border-[#2a2d33] bg-[#212327] px-3.5 py-3 space-y-2">
                  <div className="text-[12px] font-medium">{label}</div>
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={field.value}
                    onChange={(e) => patchSystem(key, { value: e.target.value })}
                    placeholder="Value, or leave blank if unresolved"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={labelClass}>Status</label>
                      <select
                        className={inputClass}
                        value={field.status}
                        onChange={(e) => patchSystem(key, { status: e.target.value as FieldStatus })}
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
                        onChange={(e) => patchSystem(key, { ownerName: e.target.value })}
                        placeholder="Required to confirm"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Note / conflict</label>
                      <input
                        className={inputClass}
                        value={field.note}
                        onChange={(e) => patchSystem(key, { note: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </SpecSection>

          <SpecSection number="4" title="Effort & Timing">
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
          </SpecSection>

          <SpecSection number="5" title="Controls & Dependencies">
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
          </SpecSection>

          <SpecSection number="6" title="Tags">
            <div>
              <label className={labelClass} htmlFor="tags">
                Tags (comma-separated)
              </label>
              <input id="tags" className={inputClass} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Urgent, Revenue" />
            </div>
          </SpecSection>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#33363c] px-6 py-4">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded text-[12px] text-[#8B9099] hover:text-[#E8E6E1]">
            Cancel
          </button>
          <button type="submit" className="px-3 py-1.5 rounded text-[12px] font-medium bg-[#C9762E] text-[#1C1E22]">
            Create deal record
          </button>
        </div>
      </form>
    </div>
  );
}
