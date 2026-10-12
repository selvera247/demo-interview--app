import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  FileText,
  LayoutGrid,
  Lock,
  Package,
  Plus,
  Unlock,
  Zap,
} from "lucide-react";
import {
  toDealViews,
  type DealSourcingItem,
  type DealView,
} from "../src/data/deal-adapter";
import { addDealFromIntake, type NewDealIntake } from "../src/data/create-deal";
import { formatProjectCode } from "../src/domain/ids";
import { createSeedState } from "../src/data/seed";
import NewDealPanel from "./NewDealPanel";

/** Featured CRM↔ERP commercial gap for banner + drill-down (GE-2026-0422 and similar). */
function getCommercialGap(deal: DealView): {
  title: string;
  summary: string;
  flagCount: number;
} | null {
  const flagged = deal.sourcing.items.filter((i) => i.flag);
  const gapFlag = flagged.find(
    (i) =>
      /\$1\.6M|gap|Closed Won|no matching/i.test(i.flag || "") ||
      i.poStatus === "blocked",
  );
  const revenueGap =
    /\$1\.6M|discrepancy|gap/i.test(deal.meta.revenueImpact || "") ||
    /\$1\.6M|gap/i.test(deal.meta.expectedOutcome || "");
  if (!gapFlag && !revenueGap && flagged.length === 0) return null;
  if (!gapFlag && !revenueGap) return null;
  return {
    title: "Commercial integrity gap · $1.6M / 3 MW",
    summary:
      gapFlag?.flag ||
      deal.meta.revenueImpact ||
      "CRM opportunity / contract amounts do not match ERP sales order + PO.",
    flagCount: flagged.length || 1,
  };
}

const categoryLabels = {
  materials: "Materials",
  labor: "Labor",
  engineering: "Engineering",
  freight: "Freight / logistics",
} as const;

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function sumCost(costObj: Record<string, number>) {
  return Object.values(costObj).reduce((a, b) => a + b, 0);
}

const fieldLabels: Record<string, string> = {
  voltage: "Voltage",
  load: "Load",
  phase: "Phase configuration",
  coolingType: "Cooling type",
  spaceConstraints: "Site / space constraints",
  requestedDelivery: "Requested delivery",
  customerPowerReady: "Customer power / interconnection status",
  deliveryDefinition: 'Definition of "delivery"',
};

const stageLabels: Record<string, string> = {
  intake: "Intake",
  engineering: "Engineering review",
  sourcing: "Sourcing",
  invoicing: "Invoicing",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "confirmed") return <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />;
  if (status === "conflicting") return <AlertTriangle size={16} className="text-amber-500 shrink-0" />;
  return <Circle size={16} className="text-slate-500 shrink-0" />;
}

function statusText(status: string) {
  if (status === "confirmed") return "Confirmed";
  if (status === "conflicting") return "Conflicting";
  return "Unresolved";
}

export default function App() {
  const [state, setState] = useState(() => createSeedState());
  const deals = useMemo(() => toDealViews(state), [state]);
  const [selectedId, setSelectedId] = useState(deals[0]?.id);
  const [view, setView] = useState<"spec" | "sourcing" | "cost">("sourcing");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const selected = deals.find((d) => d.id === selectedId);

  const nextCode = useMemo(() => {
    const year = new Date().getFullYear();
    let max = 0;
    for (const project of state.projects) {
      const match = project.projectCode.match(/^GE-(\d{4})-(\d{4})$/);
      if (match && Number(match[1]) === year) max = Math.max(max, Number(match[2]));
    }
    return formatProjectCode(year, max + 1);
  }, [state.projects]);

  function saveIntake(intake: NewDealIntake) {
    const result = addDealFromIntake(state, intake, new Date().toISOString());
    setState(result.state);
    setSelectedId(result.projectCode);
    setView("spec");
    setIntakeOpen(false);
  }

  const summarize = (deal: DealView) => {
    const vals = Object.values(deal.fields);
    const unresolved = vals.filter((f) => f.status === "tbd").length;
    const conflicting = vals.filter((f) => f.status === "conflicting").length;
    return { unresolved, conflicting };
  };

  return (
    <div className="min-h-screen bg-[#1C1E22] text-[#E8E6E1]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="border-b border-[#33363c] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-[#C9762E]/15 border border-[#C9762E]/40">
            <Zap size={16} className="text-[#C9762E]" />
          </div>
          <div>
            <div className="text-[15px] font-semibold tracking-tight">Deal Record</div>
            <div className="text-[12px] text-[#8B9099]">
              Opportunity → contract → sales order → PO on one project ID
            </div>
          </div>
        </div>
        <div
          className="flex gap-1 bg-[#212327] border border-[#33363c] rounded-md p-1"
          role="tablist"
          aria-label="Deal Record views"
        >
          {(
            [
              ["spec", "Spec", FileText],
              ["sourcing", "Sourcing", Package],
              ["cost", "Cost tracking", LayoutGrid],
            ] as const
          ).map(([id, label, Icon]) => {
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                  active
                    ? "bg-[#C9762E]/20 text-[#E8E6E1] shadow-[inset_0_0_0_1px_rgba(201,118,46,0.55)]"
                    : "text-[#8B9099] hover:text-[#E8E6E1] hover:bg-[#2a2d33]/60"
                }`}
              >
                <Icon size={13} className={active ? "text-[#C9762E]" : undefined} />
                {label}
                {active && (
                  <span
                    className="absolute left-2 right-2 -bottom-[3px] h-0.5 rounded-full bg-[#C9762E]"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex" style={{ minHeight: "calc(100vh - 65px)" }}>
        <div className="w-[280px] border-r border-[#33363c] flex flex-col">
          <div className="px-4 py-3 border-b border-[#33363c] flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-[#8B9099]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              Active deals
            </span>
            <button
              className="text-[#C9762E] hover:text-[#dd8a42] transition-colors"
              type="button"
              aria-label="Add deal"
              onClick={() => setIntakeOpen(true)}
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {deals.map((deal) => {
              const { unresolved, conflicting } = summarize(deal);
              const isSelected = deal.id === selectedId;
              return (
                <button
                  key={deal.id}
                  type="button"
                  onClick={() => setSelectedId(deal.id)}
                  className={`w-full text-left px-4 py-3 border-b border-[#2a2d33] transition-colors ${
                    isSelected ? "bg-[#2A2D33]" : "hover:bg-[#24262b]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-[#8B9099]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                      {deal.id}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1C1E22] border border-[#3a3d44] text-[#8B9099] uppercase tracking-wide">
                      {stageLabels[deal.stage]}
                    </span>
                  </div>
                  <div className="text-[13px] font-medium mb-0.5">{deal.customer}</div>
                  <div className="text-[12px] text-[#8B9099] mb-2">{deal.site}</div>
                  <div className="flex gap-3 text-[11px]">
                    {conflicting > 0 && (
                      <span className="flex items-center gap-1 text-amber-500">
                        <AlertTriangle size={11} /> {conflicting} conflict{conflicting > 1 ? "s" : ""}
                      </span>
                    )}
                    {unresolved > 0 && (
                      <span className="flex items-center gap-1 text-[#8B9099]">
                        <Circle size={11} /> {unresolved} open
                      </span>
                    )}
                    {unresolved === 0 && conflicting === 0 && (
                      <span className="flex items-center gap-1 text-emerald-500">
                        <CheckCircle2 size={11} /> Complete
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selected && view === "spec" && (
          <SpecView deal={selected} onGoToSourcing={() => setView("sourcing")} />
        )}
        {selected && view === "sourcing" && <SourcingView deal={selected} />}
        {selected && view === "cost" && (
          <CostView deal={selected} onGoToSourcing={() => setView("sourcing")} />
        )}
      </div>

      {intakeOpen && (
        <NewDealPanel nextCode={nextCode} onClose={() => setIntakeOpen(false)} onSave={saveIntake} />
      )}
    </div>
  );
}

function CommercialGapBanner({
  deal,
  onGoToSourcing,
}: {
  deal: DealView;
  onGoToSourcing: () => void;
}) {
  const gap = getCommercialGap(deal);
  if (!gap) return null;
  return (
    <div className="mb-5 rounded-md border border-amber-500/40 bg-amber-500/[0.08] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-[13px] font-semibold text-amber-300 tracking-tight">
              {gap.title}
            </div>
            <p className="text-[12px] text-amber-100/75 mt-1 leading-snug max-w-[52ch]">
              {gap.summary}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onGoToSourcing}
          className="shrink-0 text-[12px] font-medium px-3 py-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 transition-colors"
        >
          View on Sourcing →
        </button>
      </div>
    </div>
  );
}

function SpecView({
  deal,
  onGoToSourcing,
}: {
  deal: DealView;
  onGoToSourcing: () => void;
}) {
  return (
    <div className="flex-1 px-8 py-6 max-w-[760px] overflow-y-auto">
      <div className="mb-6">
        <div className="text-[12px] text-[#8B9099] mb-1" style={{ fontFamily: "JetBrains Mono, monospace" }}>
          {deal.id}
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight mb-1">{deal.customer}</h1>
        <div className="text-[13px] text-[#8B9099]">{deal.site}</div>
      </div>

      <CommercialGapBanner deal={deal} onGoToSourcing={onGoToSourcing} />

      <SpecSection number="1" title="Request Basics">
        <MetaRow label="Requestor" value={`${deal.meta.requestor} · ${deal.meta.requestorTeam}`} />
        <MetaRow label="Problem statement" value={deal.meta.problemStatement} multiline />
        <MetaRow label="Expected outcome" value={deal.meta.expectedOutcome} multiline />
      </SpecSection>

      <SpecSection number="2" title="Business Impact">
        <MetaRow label="Revenue impact" value={deal.meta.revenueImpact} />
        <MetaRow label="Audit risk" value={deal.meta.auditRisk} flag={deal.meta.auditRisk?.startsWith("Elevated")} />
        <MetaRow label="Customer impact" value={deal.meta.customerImpact} />
      </SpecSection>

      <SpecSection number="3" title="Systems & Data">
        <div className="space-y-3">
          {Object.entries(deal.fields).map(([key, field]) => (
            <div
              key={key}
              className={`rounded-md border px-4 py-3 ${
                field.status === "conflicting"
                  ? "border-amber-500/30 bg-amber-500/[0.04]"
                  : field.status === "tbd"
                    ? "border-[#3a3d44] bg-[#24262b]"
                    : "border-[#2a2d33] bg-[#212327]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="mt-0.5">
                    <StatusIcon status={field.status} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-[#8B9099] mb-0.5">{fieldLabels[key]}</div>
                    <div className={`text-[14px] ${field.value ? "text-[#E8E6E1]" : "text-[#6b7077] italic"}`}>
                      {field.value || "Not yet provided"}
                    </div>
                    {field.note && <div className="text-[12px] text-amber-400/90 mt-1.5 leading-snug">{field.note}</div>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`text-[10px] uppercase tracking-wide mb-1 ${
                      field.status === "confirmed"
                        ? "text-emerald-500"
                        : field.status === "conflicting"
                          ? "text-amber-500"
                          : "text-[#8B9099]"
                    }`}
                  >
                    {statusText(field.status)}
                  </div>
                  <div className="text-[11px] text-[#8B9099]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    {field.owner}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SpecSection>

      <SpecSection number="4" title="Effort & Timing">
        <MetaRow label="Complexity" value={deal.meta.complexity} />
        <MetaRow label="Cross-functional effort" value={deal.meta.crossFunctionalEffort} />
        <MetaRow label="Timeline pressure" value={deal.meta.timelinePressure} flag={deal.meta.timelinePressure?.startsWith("High")} />
      </SpecSection>

      <SpecSection number="5" title="Controls & Dependencies">
        <MetaRow label="Control impact" value={deal.meta.controlImpact} multiline />
        <MetaRow label="Downstream dependencies" value={deal.meta.downstreamDependencies} multiline />
      </SpecSection>

      <SpecSection number="6" title="Tags" last>
        <div className="flex gap-2 flex-wrap">
          {deal.meta.tags.map((tag) => (
            <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full border border-[#3a3d44] bg-[#24262b] text-[#c7cce0]">
              {tag}
            </span>
          ))}
        </div>
      </SpecSection>

      <div className="mt-2 pt-5 border-t border-[#2a2d33] text-[12px] text-[#8B9099] leading-relaxed">
        This record is the single reference downstream teams read from. Sourcing, cost tracking, and invoicing
        systems point back to these fields rather than re-deriving the spec from email or conversation history.
      </div>
    </div>
  );
}

function SpecSection({
  number,
  title,
  children,
  last,
}: {
  number: string;
  title: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-6"}>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#C9762E] text-[11px] font-semibold text-[#1C1E22] shrink-0">
          {number}
        </span>
        <span className="text-[13px] font-semibold tracking-tight">{title}</span>
      </div>
      <div className="pl-[30px] space-y-2.5">{children}</div>
    </div>
  );
}

function MetaRow({ label, value, multiline, flag }: { label: string; value: string; multiline?: boolean; flag?: boolean }) {
  return (
    <div
      className={`rounded-md border px-3.5 py-2.5 ${
        flag ? "border-amber-500/30 bg-amber-500/[0.04]" : "border-[#2a2d33] bg-[#212327]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] text-[#8B9099] shrink-0 w-[150px]">{label}</div>
        <div className={`text-[13px] flex-1 ${multiline ? "leading-snug" : ""} ${flag ? "text-amber-300" : "text-[#E8E6E1]"}`}>
          {value}
        </div>
        {flag && <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />}
      </div>
    </div>
  );
}

const poStatusMeta: Record<string, { label: string; color: string; bg: string }> = {
  blocked: { label: "Blocked", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30" },
  ordered: { label: "Ordered", color: "text-slate-300", bg: "bg-[#24262b] border-[#3a3d44]" },
  confirmed: { label: "Confirmed", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" },
  "in production": { label: "In production", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" },
  shipped: { label: "Shipped", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30" },
  received: { label: "Received", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30" },
};

function SourcingView({ deal }: { deal: DealView }) {
  const [detailItem, setDetailItem] = useState<DealSourcingItem | null>(null);

  if (!deal.sourcing.items.length) {
    return (
      <div className="flex-1 px-8 py-6 max-w-[760px]">
        <DealHeader deal={deal} />
        <div className="rounded-md border border-[#3a3d44] bg-[#24262b] px-4 py-5 text-[13px] text-[#8B9099]">
          No BOM received yet. Sourcing cannot issue purchase orders until the spec is confirmed and engineering
          locks a bill of materials.
        </div>
      </div>
    );
  }

  const taggedCount = deal.sourcing.items.filter((i) => i.tagged).length;
  const totalCommitted = deal.sourcing.items.reduce((a, i) => a + i.committedAmount, 0);
  const flaggedItems = deal.sourcing.items.filter((i) => i.flag);

  return (
    <div className="flex-1 flex min-h-0 relative">
      <div className="flex-1 px-8 py-6 max-w-[800px] overflow-y-auto">
        <div className="mb-6 flex items-start justify-between">
          <DealHeader deal={deal} />
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[12px] ${
              deal.sourcing.bomLocked
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-400"
            }`}
          >
            {deal.sourcing.bomLocked ? <Lock size={13} /> : <Unlock size={13} />}
            BOM {deal.sourcing.bomLocked ? "locked" : "open"}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-md border border-[#2a2d33] bg-[#212327] px-4 py-3">
            <div className="text-[11px] text-[#8B9099] mb-1 uppercase tracking-wide">Committed via POs</div>
            <div className="text-[18px] font-semibold">{fmt(totalCommitted)}</div>
          </div>
          <div className="rounded-md border border-[#2a2d33] bg-[#212327] px-4 py-3">
            <div className="text-[11px] text-[#8B9099] mb-1 uppercase tracking-wide">Project-tagged POs</div>
            <div className="text-[18px] font-semibold">
              {taggedCount} / {deal.sourcing.items.length}
            </div>
          </div>
          <div className={`rounded-md border px-4 py-3 ${flaggedItems.length ? "border-amber-500/30 bg-amber-500/[0.05]" : "border-[#2a2d33] bg-[#212327]"}`}>
            <div className="text-[11px] text-[#8B9099] mb-1 uppercase tracking-wide">Flags</div>
            <div className={`text-[18px] font-semibold ${flaggedItems.length ? "text-amber-500" : ""}`}>{flaggedItems.length}</div>
          </div>
        </div>

        {flaggedItems.length > 0 && (
          <p className="text-[12px] text-[#8B9099] mb-3">
            Flagged lines are clickable — open details, history, and hold-buy guidance.
          </p>
        )}

        <div className="space-y-2.5">
          {deal.sourcing.items.map((item) => {
            const status = poStatusMeta[item.poStatus] ?? poStatusMeta.ordered;
            const interactive = Boolean(item.flag);
            const selected = detailItem?.item === item.item;
            return (
              <div
                key={item.item}
                role={interactive ? "button" : undefined}
                tabIndex={interactive ? 0 : undefined}
                onClick={() => interactive && setDetailItem(item)}
                onKeyDown={(e) => {
                  if (interactive && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setDetailItem(item);
                  }
                }}
                className={`rounded-md border px-4 py-3 text-left transition-colors ${
                  item.flag
                    ? `border-amber-500/30 bg-amber-500/[0.04] cursor-pointer hover:bg-amber-500/[0.09] ${
                        selected ? "ring-1 ring-amber-500/50" : ""
                      }`
                    : "border-[#2a2d33] bg-[#212327]"
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium mb-0.5">{item.item}</div>
                    <div className="text-[12px] text-[#8B9099]">{item.supplier}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {interactive && (
                      <span className="text-[10px] uppercase tracking-wide text-amber-400/90">
                        Details
                      </span>
                    )}
                    <span className={`text-[11px] px-2 py-0.5 rounded border ${status.bg} ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-[12px] text-[#8B9099] flex-wrap">
                  {item.poNumber && <span style={{ fontFamily: "JetBrains Mono, monospace" }}>{item.poNumber}</span>}
                  {item.committedAmount > 0 && <span>{fmt(item.committedAmount)}</span>}
                  {item.leadTimeWeeks && <span>{item.leadTimeWeeks} wk lead time</span>}
                  {item.projectedArrival && <span>Arrival: {item.projectedArrival}</span>}
                  <span className={`flex items-center gap-1 ${item.tagged ? "text-emerald-500" : "text-amber-500"}`}>
                    {item.tagged ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                    {item.tagged ? "Tagged to project" : "Untagged"}
                  </span>
                </div>
                {item.flag && (
                  <div className="text-[12px] text-amber-400/90 mt-2 leading-snug flex items-start gap-1.5">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    {item.flag}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-5 border-t border-[#2a2d33] text-[12px] text-[#8B9099] leading-relaxed">
          Every PO tagged to this project ID flows straight into committed cost on the Cost tracking tab, the moment
          it's issued — not when the supplier invoice arrives.
        </div>
      </div>

      {detailItem && (
        <FlagDetailPanel
          dealId={deal.id}
          item={detailItem}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
}

function FlagDetailPanel({
  dealId,
  item,
  onClose,
}: {
  dealId: string;
  item: DealSourcingItem;
  onClose: () => void;
}) {
  const status = poStatusMeta[item.poStatus] ?? poStatusMeta.ordered;
  return (
    <aside
      className="w-[320px] shrink-0 border-l border-[#33363c] bg-[#212327] flex flex-col"
      aria-label="Flagged line details"
    >
      <div className="px-4 py-3 border-b border-[#33363c] flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-amber-500 mb-0.5">
            Exception detail
          </div>
          <div className="text-[13px] font-semibold text-[#E8E6E1] leading-snug">
            {item.item}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[12px] text-[#8B9099] hover:text-[#E8E6E1] px-2 py-1 rounded border border-[#33363c]"
        >
          Close
        </button>
      </div>
      <div className="px-4 py-4 space-y-4 overflow-y-auto text-[12px]">
        <div>
          <div className="text-[#8B9099] uppercase tracking-wide text-[10px] mb-1">Project</div>
          <div style={{ fontFamily: "JetBrains Mono, monospace" }}>{dealId}</div>
        </div>
        <div>
          <div className="text-[#8B9099] uppercase tracking-wide text-[10px] mb-1">Supplier</div>
          <div>{item.supplier}</div>
        </div>
        <div className="flex gap-4">
          <div>
            <div className="text-[#8B9099] uppercase tracking-wide text-[10px] mb-1">PO</div>
            <div style={{ fontFamily: "JetBrains Mono, monospace" }}>
              {item.poNumber || "—"}
            </div>
          </div>
          <div>
            <div className="text-[#8B9099] uppercase tracking-wide text-[10px] mb-1">Status</div>
            <span className={`text-[11px] px-2 py-0.5 rounded border ${status.bg} ${status.color}`}>
              {status.label}
            </span>
          </div>
        </div>
        <div>
          <div className="text-[#8B9099] uppercase tracking-wide text-[10px] mb-1">Committed</div>
          <div>{item.committedAmount > 0 ? fmt(item.committedAmount) : "—"}</div>
        </div>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5">
          <div className="text-amber-400 uppercase tracking-wide text-[10px] mb-1 flex items-center gap-1">
            <AlertTriangle size={11} /> Flag
          </div>
          <p className="text-amber-100/80 leading-snug">{item.flag}</p>
        </div>
        <div>
          <div className="text-[#8B9099] uppercase tracking-wide text-[10px] mb-1.5">
            Suggested next actions
          </div>
          <ul className="space-y-1.5 text-[#c7cce0] list-disc pl-4 leading-snug">
            <li>Hold further buy until CRM opportunity / contract matches ERP SO + PO.</li>
            <li>Confirm with RevOps whether expansion ($1.6M / 3 MW) needs a new SO line.</li>
            <li>
              Trace the Workato-shaped exception recipe above for detect → notify →
              block-buy audit.
            </li>
          </ul>
        </div>
        <div className="text-[#6b7077] leading-snug border-t border-[#33363c] pt-3">
          Synthetic demo — detail panel illustrates exception drill-down; no live ERP write-back.
        </div>
      </div>
    </aside>
  );
}

function DealHeader({ deal }: { deal: DealView }) {
  return (
    <div className="mb-6">
      <div className="text-[12px] text-[#8B9099] mb-1" style={{ fontFamily: "JetBrains Mono, monospace" }}>
        {deal.id}
      </div>
      <h1 className="text-[22px] font-semibold tracking-tight mb-1">{deal.customer}</h1>
      <div className="text-[13px] text-[#8B9099]">{deal.site}</div>
    </div>
  );
}

function CostView({
  deal,
  onGoToSourcing,
}: {
  deal: DealView;
  onGoToSourcing: () => void;
}) {
  const quotedTotal = sumCost(deal.cost.quoted);
  const committedTotal = sumCost(deal.cost.committed);
  const actualTotal = sumCost(deal.cost.actual);
  const liveMargin = quotedTotal - committedTotal;
  const marginPct = quotedTotal > 0 ? (liveMargin / quotedTotal) * 100 : null;
  const consumedPct = quotedTotal > 0 ? (committedTotal / quotedTotal) * 100 : 0;
  const isWarning = consumedPct >= 85;

  if (quotedTotal === 0) {
    return (
      <div className="flex-1 px-8 py-6 max-w-[720px]">
        <DealHeader deal={deal} />
        <CommercialGapBanner deal={deal} onGoToSourcing={onGoToSourcing} />
        <div className="rounded-md border border-[#3a3d44] bg-[#24262b] px-4 py-5 text-[13px] text-[#8B9099]">
          No quote issued yet. Cost tracking activates once the spec is confirmed and a baseline quote is committed
          to the customer.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 px-8 py-6 max-w-[760px] overflow-y-auto">
      <DealHeader deal={deal} />
      <CommercialGapBanner deal={deal} onGoToSourcing={onGoToSourcing} />
      <div className={`rounded-md border px-5 py-4 mb-5 ${isWarning ? "border-amber-500/40 bg-amber-500/[0.05]" : "border-[#2a2d33] bg-[#212327]"}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] text-[#8B9099] uppercase tracking-wide">Live margin</span>
          {isWarning ? (
            <span className="flex items-center gap-1 text-[11px] text-amber-500">
              <AlertTriangle size={12} /> {consumedPct.toFixed(0)}% of quote committed
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-[#8B9099]">{consumedPct.toFixed(0)}% of quote committed</span>
          )}
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className={`text-[26px] font-semibold tracking-tight ${liveMargin < quotedTotal * 0.15 ? "text-amber-500" : "text-emerald-500"}`}>
              {fmt(liveMargin)}
            </div>
            <div className="text-[12px] text-[#8B9099] mt-0.5">
              {marginPct !== null ? `${marginPct.toFixed(1)}% margin, based on committed cost` : "—"}
            </div>
          </div>
          <div className="text-right text-[12px] text-[#8B9099] leading-relaxed">
            <div>
              Quoted: <span className="text-[#E8E6E1]">{fmt(quotedTotal)}</span>
            </div>
            <div>
              Committed: <span className="text-[#E8E6E1]">{fmt(committedTotal)}</span>
            </div>
            <div>
              Actual (invoiced/paid): <span className="text-[#E8E6E1]">{fmt(actualTotal)}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-[#1C1E22] overflow-hidden">
          <div className={`h-full rounded-full ${isWarning ? "bg-amber-500" : "bg-[#C9762E]"}`} style={{ width: `${Math.min(consumedPct, 100)}%` }} />
        </div>
      </div>

      <div className="mb-5">
        <div className="text-[11px] uppercase tracking-wide text-[#8B9099] mb-2" style={{ fontFamily: "JetBrains Mono, monospace" }}>
          By category
        </div>
        <div className="space-y-2">
          {(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map((cat) => {
            const q = deal.cost.quoted[cat];
            const c = deal.cost.committed[cat];
            const pct = q > 0 ? (c / q) * 100 : 0;
            return (
              <div key={cat} className="rounded-md border border-[#2a2d33] bg-[#212327] px-4 py-2.5">
                <div className="flex items-center justify-between text-[13px] mb-1.5">
                  <span>{categoryLabels[cat]}</span>
                  <span className="text-[#8B9099]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    {fmt(c)} / {fmt(q)}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-[#1C1E22] overflow-hidden">
                  <div className={`h-full rounded-full ${pct >= 90 ? "bg-amber-500" : "bg-[#4F9767]"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wide text-[#8B9099] mb-2" style={{ fontFamily: "JetBrains Mono, monospace" }}>
          Cost log
        </div>
        <div className="space-y-2">
          {deal.cost.log.map((entry, i) => (
            <div
              key={`${entry.date}-${entry.desc}-${i}`}
              className={`rounded-md border px-4 py-2.5 flex items-center justify-between gap-3 ${
                entry.flag ? "border-amber-500/30 bg-amber-500/[0.04]" : "border-[#2a2d33] bg-[#212327]"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] text-[#8B9099]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    {entry.date}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1C1E22] border border-[#3a3d44] text-[#8B9099] uppercase tracking-wide">
                    {entry.type}
                  </span>
                </div>
                <div className="text-[13px]">{entry.desc}</div>
                {entry.flag && (
                  <div className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1">
                    <AlertTriangle size={10} /> Unplanned — tied to spec conflict, not in original quote
                  </div>
                )}
              </div>
              <div className="text-[13px] shrink-0" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                {fmt(entry.amount)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-5 border-t border-[#2a2d33] text-[12px] text-[#8B9099] leading-relaxed">
        Committed cost counts the moment a PO is issued or labor is logged — not when the supplier invoice arrives.
        Margin erosion shows up here before it shows up at project close.
      </div>
    </div>
  );
}
