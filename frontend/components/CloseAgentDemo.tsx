import { useMemo, useState } from "react";
import demo from "../data/closeAgentDemo.json";

type Variance = (typeof demo.variances)[number];
type ReviewStatus = "pending" | "approved" | "edited" | "rejected";

type Draft = {
  account_id: string;
  commentary: string;
  confidence: number;
  flags: string[];
  citations: string[];
  status: ReviewStatus;
  reviewNote: string;
};

function fmt(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function buildDraft(v: Variance): Draft {
  const txns = demo.subledger.filter((t) => t.account_id === v.account_id);
  const anomaly = demo.anomalies.find((a) => a.account === v.account_id);
  const citations: string[] = [];
  const flags: string[] = [];
  let confidence = 0.4;
  const lines: string[] = [];

  for (const t of txns) {
    const memo = t.memo.toLowerCase();
    if (memo.includes("duplicate") || t.txn_id.endsWith("-DUP")) {
      flags.push("possible_duplicate_je");
      confidence = Math.max(confidence, 0.92);
      citations.push(t.txn_id, t.party_id || "");
      lines.push(
        `${t.txn_id} (${fmt(t.amount)}) looks like a duplicate accrual — route for reversal.`
      );
    } else if (memo.includes("reclass")) {
      flags.push("reclass");
      confidence = Math.max(confidence, 0.88);
      citations.push(t.txn_id);
      lines.push(`Reclass ${t.txn_id}: ${t.memo} (${fmt(t.amount)}).`);
    } else if (memo.includes("deferred") || memo.includes("renewal")) {
      flags.push("revenue_timing");
      confidence = Math.max(confidence, 0.86);
      citations.push(t.txn_id, t.party_id || "");
      lines.push(`Revenue timing ${t.txn_id}: ${t.memo} (${fmt(t.amount)}).`);
    }
  }

  if (!lines.length) {
    flags.push("needs_human_review");
    lines.push(
      anomaly
        ? anomaly.explanation
        : "No clear subledger driver above noise; marking for human review rather than guessing."
    );
    confidence = anomaly ? 0.7 : 0.35;
  }

  const commentary =
    `${v.account_name} (${v.account_id}) moved ${pct(v.variance_pct)} ` +
    `(${fmt(v.variance_amt)}) from ${v.period_a} to ${v.period_b}. ` +
    lines.join(" ") +
    (confidence < 0.6 ? " LOW CONFIDENCE — hold for reviewer." : "");

  return {
    account_id: v.account_id,
    commentary,
    confidence,
    flags: [...new Set(flags)],
    citations: [...new Set(citations.filter(Boolean))],
    status: confidence < 0.6 || flags.includes("possible_duplicate_je") ? "pending" : "pending",
    reviewNote: "",
  };
}

export default function CloseAgentDemo() {
  const flagged = useMemo(
    () => demo.variances.filter((v) => v.over_threshold),
    []
  );
  const [selectedId, setSelectedId] = useState(flagged[0]?.account_id ?? "");
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const init: Record<string, Draft> = {};
    for (const v of flagged) init[v.account_id] = buildDraft(v);
    return init;
  });
  const [log, setLog] = useState(demo.sample_tool_log);
  const [threshold] = useState(demo.threshold_pct);

  const selected = flagged.find((v) => v.account_id === selectedId) ?? flagged[0];
  const draft = selected ? drafts[selected.account_id] : undefined;
  const txns = selected
    ? demo.subledger.filter((t) => t.account_id === selected.account_id)
    : [];

  function selectAccount(v: Variance) {
    setSelectedId(v.account_id);
    setLog((prev) => [
      {
        tool_name: "get_account_variance",
        arguments: {
          account: v.account_id,
          period_a: v.period_a,
          period_b: v.period_b,
        },
        result_summary: `variance_pct=${v.variance_pct}; over_threshold=${v.over_threshold}`,
      },
      {
        tool_name: "get_subledger_detail",
        arguments: { account: v.account_id, period: v.period_b },
        result_summary: `${demo.subledger.filter((t) => t.account_id === v.account_id).length} txns`,
      },
      {
        tool_name: "draft_flux_commentary",
        arguments: { account: v.account_id, threshold },
        result_summary: "draft queued for human review",
      },
      ...prev,
    ].slice(0, 12));
  }

  function setStatus(status: ReviewStatus) {
    if (!selected) return;
    setDrafts((prev) => ({
      ...prev,
      [selected.account_id]: { ...prev[selected.account_id], status },
    }));
  }

  return (
    <div className="demo-shell">
      <div className="demo-toolbar">
        <div>
          <strong>
            {demo.entity} · {demo.prior_period} → {demo.period}
          </strong>
          <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 4 }}>
            Threshold {pct(demo.threshold_pct)} and {fmt(demo.threshold_amt)} ·{" "}
            {flagged.length} accounts flagged
          </div>
        </div>
        <div className="score">Eval score: unpublished (answer keys pending)</div>
      </div>

      <div className="demo-grid">
        <div className="demo-col">
          <h3>Flagged variances</h3>
          {flagged.map((v) => (
            <button
              key={v.account_id}
              type="button"
              className={`var-row${v.account_id === selected?.account_id ? " active" : ""}`}
              onClick={() => selectAccount(v)}
            >
              <span>
                {v.account_id} · {v.account_name}
              </span>
              <span className="amt">{pct(v.variance_pct)}</span>
              <span className="amt">{fmt(v.variance_amt)}</span>
            </button>
          ))}

          <h3 style={{ marginTop: "1.25rem" }}>Tool call log</h3>
          {log.map((entry, i) => (
            <div className="log-line" key={`${entry.tool_name}-${i}`}>
              {entry.tool_name}({JSON.stringify(entry.arguments)}) → {entry.result_summary}
            </div>
          ))}
        </div>

        <div className="demo-col">
          <h3>Draft commentary + review</h3>
          {draft && selected ? (
            <>
              <div>
                <span className={`pill ${draft.confidence < 0.6 ? "low" : "ok"}`}>
                  confidence {(draft.confidence * 100).toFixed(0)}%
                </span>
                <span className="pill">{draft.status}</span>
                {draft.flags.map((f) => (
                  <span className="pill low" key={f}>
                    {f}
                  </span>
                ))}
              </div>
              <p className="commentary">{draft.commentary}</p>
              <div style={{ marginTop: "0.75rem" }}>
                <h3>Citations</h3>
                {draft.citations.length ? (
                  draft.citations.map((c) => (
                    <span className="pill ok" key={c}>
                      {c}
                    </span>
                  ))
                ) : (
                  <span className="pill low">none — human review</span>
                )}
              </div>
              <div style={{ marginTop: "0.75rem" }}>
                <h3>Subledger drivers</h3>
                {txns.length ? (
                  txns.map((t) => (
                    <div className="log-line" key={t.txn_id}>
                      {t.txn_id} · {t.memo} · {fmt(t.amount)}
                    </div>
                  ))
                ) : (
                  <p className="commentary">No subledger rows in export for this account.</p>
                )}
              </div>
              <div className="review-actions">
                <button type="button" className="btn btn-primary" onClick={() => setStatus("approved")}>
                  Approve
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setStatus("edited")}>
                  Mark edited
                </button>
                <button type="button" className="btn btn-warm" onClick={() => setStatus("rejected")}>
                  Reject
                </button>
              </div>
            </>
          ) : (
            <p className="commentary">Select a flagged account.</p>
          )}
        </div>
      </div>
    </div>
  );
}
