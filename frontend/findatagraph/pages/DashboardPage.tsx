import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import Money from "../components/Money";
import StatusBadge from "../components/StatusBadge";
import { fdgPath } from "../demoBase";
import { api, type FdgException } from "../mockApi";

type Summary = {
  open_exceptions: number;
  open_variance_abs: number;
  resolved_last_7_days: number;
  by_type: { exception_type: string; count: number }[];
  by_entity: {
    entity_code: string;
    entity_name: string;
    count: number;
    variance_abs: number;
  }[];
  last_run: {
    status: string;
    exception_count: number;
    definition_name?: string;
  } | null;
};

export default function DashboardPage() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [exceptions, setExceptions] = useState<FdgException[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api("/dashboard/summary", { token: token || undefined }),
      api("/exceptions?status=open", { token: token || undefined }),
    ])
      .then(([dash, ex]) => {
        if (cancelled) return;
        setSummary(dash as Summary);
        setExceptions((ex as { data: FdgException[] }).data.slice(0, 8));
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) return <p className="fdg-error">{error}</p>;
  if (!summary) return <p className="fdg-empty">Loading dashboard…</p>;

  return (
    <div className="fdg-stack">
      <header className="fdg-page-header">
        <div>
          <h1>Close control tower</h1>
          <p>Open exceptions, variance exposure, and latest reconciliation run.</p>
        </div>
        <Link className="fdg-btn" to={fdgPath("/runs")}>
          Run reconciliation
        </Link>
      </header>

      <section className="fdg-grid-kpi">
        <article className="fdg-kpi">
          <div className="fdg-kpi-label">Open exceptions</div>
          <div className="fdg-kpi-value">{summary.open_exceptions}</div>
        </article>
        <article className="fdg-kpi">
          <div className="fdg-kpi-label">Open variance</div>
          <div className="fdg-kpi-value">
            <Money value={summary.open_variance_abs} />
          </div>
        </article>
        <article className="fdg-kpi">
          <div className="fdg-kpi-label">Resolved (7d)</div>
          <div className="fdg-kpi-value">{summary.resolved_last_7_days}</div>
        </article>
        <article className="fdg-kpi">
          <div className="fdg-kpi-label">Last run</div>
          <div className="fdg-kpi-value fdg-kpi-value-sm">
            {summary.last_run
              ? `${summary.last_run.status} · ${summary.last_run.exception_count} breaks`
              : "No runs yet"}
          </div>
        </article>
      </section>

      <div className="fdg-split">
        <section className="fdg-panel">
          <div className="fdg-panel-header">
            <h2>Top open exceptions</h2>
            <Link to={fdgPath("/exceptions")}>View all</Link>
          </div>
          <div className="fdg-table-wrap">
            <table className="fdg-data">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Entity</th>
                  <th>Variance</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link to={fdgPath(`/exceptions/${e.id}`)}>{e.reference}</Link>
                      <div className="fdg-cell-sub">{e.title}</div>
                    </td>
                    <td>
                      <StatusBadge value={e.exception_type} kind="type" />
                    </td>
                    <td>{e.entity_code}</td>
                    <td>
                      <Money value={e.variance} currency={e.currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="fdg-panel">
          <div className="fdg-panel-header">
            <h2>By type</h2>
          </div>
          <ul className="fdg-stat-list">
            {summary.by_type.map((t) => (
              <li key={t.exception_type}>
                <StatusBadge value={t.exception_type} kind="type" />
                <strong>{t.count}</strong>
              </li>
            ))}
          </ul>
          <div className="fdg-panel-header" style={{ marginTop: "1.25rem" }}>
            <h2>By entity</h2>
          </div>
          <ul className="fdg-stat-list">
            {summary.by_entity.map((t) => (
              <li key={t.entity_code}>
                <span>
                  {t.entity_code}
                  <span className="fdg-cell-sub">{t.entity_name}</span>
                </span>
                <strong>
                  {t.count} · <Money value={t.variance_abs} />
                </strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
