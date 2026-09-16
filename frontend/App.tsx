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
import { toDealViews, type DealView } from "../src/data/deal-adapter";
import { createSeedState } from "../src/data/seed";

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
  const deals = useMemo(() => toDealViews(createSeedState()), []);
  const [selectedId, setSelectedId] = useState(deals[0]?.id);
  const [view, setView] = useState<"spec" | "sourcing" | "cost">("spec");
  const selected = deals.find((d) => d.id === selectedId);

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
            <div className="text-[12px] text-[#8B9099]">One system of record, from customer spec through cost and margin</div>
          </div>
        </div>
        <div className="flex gap-1 bg-[#212327] border border-[#33363c] rounded-md p-1">
          <button
            onClick={() => setView("spec")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
              view === "spec" ? "bg-[#33363c] text-[#E8E6E1]" : "text-[#8B9099] hover:text-[#E8E6E1]"
            }`}
          >
            <FileText size={13} /> Spec
          </button>
          <button
            onClick={() => setView("sourcing")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
              view === "sourcing" ? "bg-[#33363c] text-[#E8E6E1]" : "text-[#8B9099] hover:text-[#E8E6E1]"
            }`}
          >
            <Package size={13} /> Sourcing
          </button>
          <button
            onClick={() => setView("cost")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
              view === "cost" ? "bg-[#33363c] text-[#E8E6E1]" : "text-[#8B9099] hover:text-[#E8E6E1]"
            }`}
          >
            <LayoutGrid size={13} /> Cost tracking
          </button>
        </div>
      </div>

      <div className="flex" style={{ minHeight: "calc(100vh - 65px)" }}>
        <div className="w-[280px] border-r border-[#33363c] flex flex-col">
          <div className="px-4 py-3 border-b border-[#33363c] flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-[#8B9099]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              Active deals
            </span>
            <button className="text-[#C9762E] hover:text-[#dd8a42] transition-colors" type="button" aria-label="Add deal">
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

        {selected && view === "spec" && <SpecView deal={selected} />}
        {selected && view === "sourcing" && <SourcingView deal={selected} />}
        {selected && view === "cost" && <CostView deal={selected} />}
      </div>
    </div>
  );
}

function SpecView({ deal }: { deal: DealView }) {
  return (
    <div className="flex-1 px-8 py-6 max-w-[760px] overflow-y-auto">
      <div className="mb-6">
        <div className="text-[12px] text-[#8B9099] mb-1" style={{ fontFamily: "JetBrains Mono, monospace" }}>
          {deal.id}
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight mb-1">{deal.customer}</h1>
        <div className="text-[13px] text-[#8B9099]">{deal.site}</div>
      </div>

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

      <div className="space-y-2.5">
        {deal.sourcing.items.map((item) => {
          const status = poStatusMeta[item.poStatus] ?? poStatusMeta.ordered;
          return (
            <div
              key={item.item}
              className={`rounded-md border px-4 py-3 ${item.flag ? "border-amber-500/30 bg-amber-500/[0.04]" : "border-[#2a2d33] bg-[#212327]"}`}
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium mb-0.5">{item.item}</div>
                  <div className="text-[12px] text-[#8B9099]">{item.supplier}</div>
                </div>
                <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded border ${status.bg} ${status.color}`}>{status.label}</span>
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

function CostView({ deal }: { deal: DealView }) {
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
