import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { fdgPath } from "../demoBase";
import { api, type FdgSpec, type FdgStartingPoint } from "../mockApi";

export default function SpecStudioPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [startingPoints, setStartingPoints] = useState<FdgStartingPoint[]>([]);
  const [need, setNeed] = useState("");
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [spec, setSpec] = useState<FdgSpec | null>(null);
  const [history, setHistory] = useState<FdgSpec[]>([]);
  const [usage, setUsage] = useState({ credits_used: 0, events: 0 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function refresh() {
    const [points, specs, use] = await Promise.all([
      api("/specs/starting-points", { token: token || undefined }),
      api("/specs", { token: token || undefined }),
      api("/specs/usage", { token: token || undefined }),
    ]);
    setStartingPoints((points as { data: FdgStartingPoint[] }).data);
    setHistory((specs as { data: FdgSpec[] }).data);
    setUsage((use as { data: { credits_used: number; events: number } }).data);
  }

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function pickPoint(point: FdgStartingPoint) {
    setSelectedPoint(point.id);
    setNeed(point.example_need);
    setSpec(null);
    setError("");
  }

  async function onGenerate(e?: FormEvent) {
    e?.preventDefault();
    setBusy("generate");
    setError("");
    try {
      const res = await api("/specs/generate", {
        token: token || undefined,
        method: "POST",
        body: {
          need: need.trim() || undefined,
          starting_point_id: selectedPoint || undefined,
        },
      });
      setSpec((res as { data: FdgSpec }).data);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setBusy("");
    }
  }

  async function onImplement() {
    if (!spec?.id) return;
    setBusy("implement");
    setError("");
    try {
      const res = await api(`/specs/${spec.id}/implement`, {
        token: token || undefined,
        method: "POST",
      });
      setSpec((res as { data: FdgSpec }).data);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Implement failed");
    } finally {
      setBusy("");
    }
  }

  async function onRun() {
    if (!spec?.definition_id) return;
    setBusy("run");
    setError("");
    try {
      await api(`/reconciliations/${spec.definition_id}/runs`, {
        token: token || undefined,
        method: "POST",
      });
      navigate(fdgPath("/exceptions"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setBusy("");
    }
  }

  const pkg = spec?.package;
  const canImplement = user?.role === "admin" || user?.role === "controller";
  const isPartial = Boolean(pkg?.partial || pkg?.partial_implemented);

  return (
    <div className="fdg-stack">
      <header className="fdg-page-header">
        <div>
          <h1>Spec Studio</h1>
          <p>
            Dual path: open a seeded pack, or describe a need — generate the agent
            package, implement it, then run the governed loop.
          </p>
        </div>
        <div className="fdg-credits-pill" title="Demo credit meter">
          <span>Credits used</span>
          <strong>{usage.credits_used}</strong>
        </div>
      </header>

      {error ? <p className="fdg-error">{error}</p> : null}

      <section className="fdg-panel">
        <div className="fdg-panel-header">
          <h2>1 · Starting points</h2>
          <span className="fdg-hint" style={{ margin: 0 }}>
            Seeded packs stay available · free text creates a new agent
          </span>
        </div>
        <div className="fdg-studio-chips">
          {startingPoints.map((point) => (
            <button
              key={point.id}
              type="button"
              className={
                selectedPoint === point.id
                  ? "fdg-studio-chip active"
                  : "fdg-studio-chip"
              }
              onClick={() => pickPoint(point)}
            >
              <strong>{point.label}</strong>
              <span>{point.hint}</span>
              <em>{point.path === "seeded" ? "Seeded" : "Generate"}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="fdg-panel">
        <div className="fdg-panel-header">
          <h2>2 · Describe the need</h2>
        </div>
        <form className="fdg-studio-form" onSubmit={onGenerate}>
          <label htmlFor="fdg-need">Natural language intake</label>
          <textarea
            id="fdg-need"
            value={need}
            onChange={(e) => {
              setNeed(e.target.value);
              setSelectedPoint(null);
            }}
            placeholder='e.g. "reconcile CC auth, settlements, and what we received"'
          />
          <div className="fdg-action-row">
            <button className="fdg-btn" type="submit" disabled={busy === "generate"}>
              {busy === "generate" ? "Generating…" : "Generate package"}
            </button>
            <button
              className="fdg-btn fdg-btn-ghost"
              type="button"
              onClick={() => {
                setNeed("reconcile CC auth, settlements, and what we received");
                setSelectedPoint("cc_auth_settle_received");
                setSpec(null);
              }}
            >
              Try CC auth example
            </button>
          </div>
        </form>
      </section>

      {spec && pkg ? (
        <section className="fdg-panel">
          <div className="fdg-panel-header">
            <h2>3 · Agent package</h2>
            <span className="fdg-badge">{spec.status}</span>
          </div>
          <div className="fdg-studio-package">
            <h3>{pkg.name}</h3>
            <p>{pkg.summary}</p>
            <ul>
              <li>
                <strong>Systems:</strong> {pkg.systems.join(" · ")}
              </li>
              <li>
                <strong>Controls:</strong> {pkg.controls.join(" · ")}
              </li>
              {isPartial ? (
                <li className="fdg-hint">Partial implement in this demo tier.</li>
              ) : null}
            </ul>
            <div className="fdg-action-row">
              {canImplement && spec.status === "generated" ? (
                <button
                  type="button"
                  className="fdg-btn"
                  disabled={busy === "implement"}
                  onClick={() => void onImplement()}
                >
                  {busy === "implement" ? "Implementing…" : "Implement"}
                </button>
              ) : null}
              {spec.definition_id &&
              (spec.status === "implemented" || spec.path === "seeded") ? (
                <button
                  type="button"
                  className="fdg-btn"
                  disabled={busy === "run"}
                  onClick={() => void onRun()}
                >
                  {busy === "run" ? "Running…" : "Run → Exceptions"}
                </button>
              ) : null}
              <Link className="fdg-btn fdg-btn-ghost" to={fdgPath("/dashboard")}>
                Dashboard
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="fdg-panel">
        <div className="fdg-panel-header">
          <h2>Recent specs</h2>
        </div>
        <div className="fdg-table-wrap">
          <table className="fdg-data">
            <thead>
              <tr>
                <th>When</th>
                <th>Need</th>
                <th>Path</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id}>
                  <td>{s.created_at}</td>
                  <td>{s.need}</td>
                  <td>{s.path}</td>
                  <td>{s.status}</td>
                </tr>
              ))}
              {!history.length ? (
                <tr>
                  <td colSpan={4} className="fdg-empty">
                    Generate a package to populate history.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
