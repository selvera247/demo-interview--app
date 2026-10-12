import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import Money from "../components/Money";
import StatusBadge from "../components/StatusBadge";
import { fdgPath } from "../demoBase";
import { api, type FdgException } from "../mockApi";

export default function ExceptionsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<FdgException[]>([]);
  const [filter, setFilter] = useState("open");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const q = filter === "all" ? "" : `?status=${filter}`;
    api(`/exceptions${q}`, { token: token || undefined })
      .then((res) => {
        if (!cancelled) setRows((res as { data: FdgException[] }).data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token, filter]);

  return (
    <div className="fdg-stack">
      <header className="fdg-page-header">
        <div>
          <h1>Exceptions</h1>
          <p>CRM invoice ↔ GL revenue breaks for Meridian Retail (synthetic).</p>
        </div>
        <select
          className="fdg-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="waived">Waived</option>
          <option value="all">All</option>
        </select>
      </header>

      {error ? <p className="fdg-error">{error}</p> : null}

      <div className="fdg-table-wrap fdg-panel">
        <table className="fdg-data">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Type</th>
              <th>Status</th>
              <th>Entity</th>
              <th>Variance</th>
              <th>Assignee</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link to={fdgPath(`/exceptions/${e.id}`)}>{e.reference}</Link>
                  <div className="fdg-cell-sub">{e.title}</div>
                </td>
                <td>
                  <StatusBadge value={e.exception_type} kind="type" />
                </td>
                <td>
                  <StatusBadge value={e.status} />
                </td>
                <td>{e.entity_code}</td>
                <td>
                  <Money value={e.variance} currency={e.currency} />
                </td>
                <td>{e.assignee_name || "—"}</td>
              </tr>
            ))}
            {!rows.length && !error ? (
              <tr>
                <td colSpan={6} className="fdg-empty">
                  No exceptions for this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
