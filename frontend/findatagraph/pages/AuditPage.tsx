import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { api, type FdgAudit } from "../mockApi";

export default function AuditPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<FdgAudit[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api("/audit", { token: token || undefined })
      .then((res) => {
        if (!cancelled) setRows((res as { data: FdgAudit[] }).data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="fdg-stack">
      <header className="fdg-page-header">
        <div>
          <h1>Audit log</h1>
          <p>Append-only evidence for login, runs, assign, resolve, and waive.</p>
        </div>
      </header>

      {error ? <p className="fdg-error">{error}</p> : null}

      <div className="fdg-table-wrap fdg-panel">
        <table className="fdg-data">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Resource</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{a.created_at}</td>
                <td>
                  {a.actor_name}
                  <div className="fdg-cell-sub">{a.actor_email}</div>
                </td>
                <td>
                  <code>{a.action}</code>
                </td>
                <td>
                  {a.resource_type}
                  <div className="fdg-cell-sub">{a.resource_id}</div>
                </td>
              </tr>
            ))}
            {!rows.length && !error ? (
              <tr>
                <td colSpan={4} className="fdg-empty">
                  No audit events yet — sign in and take an action.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
