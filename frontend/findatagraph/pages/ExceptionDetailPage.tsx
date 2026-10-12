import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import Money from "../components/Money";
import StatusBadge from "../components/StatusBadge";
import { fdgPath } from "../demoBase";
import { api, type FdgException, type FdgUser } from "../mockApi";

export default function ExceptionDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [row, setRow] = useState<FdgException | null>(null);
  const [users, setUsers] = useState<FdgUser[]>([]);
  const [note, setNote] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const [detail, userRes] = await Promise.all([
      api(`/exceptions/${id}`, { token: token || undefined }),
      api("/users", { token: token || undefined }),
    ]);
    setRow((detail as { data: FdgException }).data);
    setUsers((userRes as { data: FdgUser[] }).data);
  }

  useEffect(() => {
    let cancelled = false;
    reload()
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(path, { token: token || undefined, method: "POST", body });
      await reload();
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  function onAssign(e: FormEvent) {
    e.preventDefault();
    void act(`/exceptions/${id}/assign`, {
      assignee_id: assigneeId || user?.id,
    });
  }

  if (error && !row) return <p className="fdg-error">{error}</p>;
  if (!row) return <p className="fdg-empty">Loading exception…</p>;

  const canWaive = user?.role === "controller" || user?.role === "admin";
  const open = row.status === "open";

  return (
    <div className="fdg-stack">
      <header className="fdg-page-header">
        <div>
          <Link className="fdg-crumb" to={fdgPath("/exceptions")}>
            ← Exceptions
          </Link>
          <h1>{row.reference}</h1>
          <p>{row.title}</p>
        </div>
        <StatusBadge value={row.status} />
      </header>

      {error ? <p className="fdg-error">{error}</p> : null}

      <section className="fdg-panel fdg-detail-grid">
        <div>
          <div className="fdg-kpi-label">Type</div>
          <StatusBadge value={row.exception_type} kind="type" />
        </div>
        <div>
          <div className="fdg-kpi-label">Entity</div>
          <strong>
            {row.entity_code} · {row.entity_name}
          </strong>
        </div>
        <div>
          <div className="fdg-kpi-label">CRM amount</div>
          <Money value={row.left_amount} currency={row.currency} />
        </div>
        <div>
          <div className="fdg-kpi-label">GL amount</div>
          <Money value={row.right_amount} currency={row.currency} />
        </div>
        <div>
          <div className="fdg-kpi-label">Variance</div>
          <Money value={row.variance} currency={row.currency} />
        </div>
        <div>
          <div className="fdg-kpi-label">Assignee</div>
          <strong>{row.assignee_name || "Unassigned"}</strong>
        </div>
      </section>

      {row.details ? (
        <section className="fdg-panel">
          <h2>Evidence</h2>
          <pre className="fdg-pre">{JSON.stringify(row.details, null, 2)}</pre>
        </section>
      ) : null}

      {row.resolution_note ? (
        <section className="fdg-panel">
          <h2>Resolution</h2>
          <p>{row.resolution_note}</p>
        </section>
      ) : null}

      {open ? (
        <section className="fdg-panel fdg-actions">
          <h2>Human gates</h2>
          <form className="fdg-inline-form" onSubmit={onAssign}>
            <select
              className="fdg-select"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              aria-label="Assignee"
            >
              <option value="">Assign to me</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
            <button className="fdg-btn fdg-btn-ghost" type="submit" disabled={busy}>
              Assign
            </button>
          </form>
          <label className="fdg-field">
            Note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Resolution or waive rationale"
            />
          </label>
          <div className="fdg-action-row">
            <button
              type="button"
              className="fdg-btn"
              disabled={busy}
              onClick={() =>
                void act(`/exceptions/${id}/resolve`, { note: note || undefined })
              }
            >
              Resolve
            </button>
            {canWaive ? (
              <button
                type="button"
                className="fdg-btn fdg-btn-ghost"
                disabled={busy}
                onClick={() =>
                  void act(`/exceptions/${id}/waive`, { note: note || undefined })
                }
              >
                Waive
              </button>
            ) : null}
          </div>
          <p className="fdg-hint">
            Material corrections (≥ $10k) require dual control on the hosted API; this
            Pages demo covers assign / resolve / waive with an append-only audit log.
          </p>
        </section>
      ) : null}
    </div>
  );
}
