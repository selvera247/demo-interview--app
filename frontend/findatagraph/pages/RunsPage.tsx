import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import StatusBadge from "../components/StatusBadge";
import { api } from "../mockApi";

type Def = {
  id: string;
  code: string;
  name: string;
  description: string;
  materiality_abs: number;
};

type Run = {
  id: string;
  status: string;
  started_at: string;
  matched_count: number;
  exception_count: number;
  definition_name?: string;
  definition_code?: string;
};

export default function RunsPage() {
  const { token, user } = useAuth();
  const [defs, setDefs] = useState<Def[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [d, r] = await Promise.all([
      api("/reconciliations", { token: token || undefined }),
      api("/reconciliations/runs", { token: token || undefined }),
    ]);
    setDefs((d as { data: Def[] }).data);
    setRuns((r as { data: Run[] }).data);
  }

  useEffect(() => {
    let cancelled = false;
    load().catch((err: Error) => {
      if (!cancelled) setError(err.message);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function trigger(defId: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/reconciliations/${defId}/runs`, {
        token: token || undefined,
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  const canRun = user?.role === "controller" || user?.role === "admin";

  return (
    <div className="fdg-stack">
      <header className="fdg-page-header">
        <div>
          <h1>Reconciliation runs</h1>
          <p>Trigger CRM ↔ GL matching and review run history.</p>
        </div>
      </header>

      {error ? <p className="fdg-error">{error}</p> : null}

      <section className="fdg-panel">
        <h2>Definitions</h2>
        {defs.map((d) => (
          <div key={d.id} className="fdg-def-row">
            <div>
              <strong>
                {d.code} · {d.name}
              </strong>
              <p className="fdg-cell-sub">{d.description}</p>
              <p className="fdg-cell-sub">
                Materiality threshold: ${d.materiality_abs.toLocaleString()}
              </p>
            </div>
            {canRun ? (
              <button
                type="button"
                className="fdg-btn"
                disabled={busy}
                onClick={() => void trigger(d.id)}
              >
                {busy ? "Running…" : "Run now"}
              </button>
            ) : (
              <span className="fdg-hint">Controller/admin to run</span>
            )}
          </div>
        ))}
      </section>

      <section className="fdg-panel">
        <h2>History</h2>
        <div className="fdg-table-wrap">
          <table className="fdg-data">
            <thead>
              <tr>
                <th>When</th>
                <th>Definition</th>
                <th>Status</th>
                <th>Matched</th>
                <th>Exceptions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.started_at).toLocaleString()}</td>
                  <td>{r.definition_code || r.definition_name}</td>
                  <td>
                    <StatusBadge value={r.status} />
                  </td>
                  <td>{r.matched_count}</td>
                  <td>{r.exception_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
