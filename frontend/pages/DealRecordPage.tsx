import { Link } from "react-router-dom";
import App from "../App";

/** Deal Record demo: CRM↔ERP PO discrepancy (generic system labels only). */
export default function DealRecordPage() {
  return (
    <div>
      <nav
        className="site-nav"
        style={{ position: "sticky", top: 0, zIndex: 30, marginBottom: 0 }}
      >
        <Link to="/" className="brand">
          Chris Selvera
        </Link>
        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/projects/close-agent">Close Agent</Link>
          <button
            type="button"
            className="linkish"
            onClick={() =>
              document
                .getElementById("live-app")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Live demo
          </button>
        </div>
      </nav>

      <article className="case-layout">
        <div className="kicker">Case study · Demo 02 · CRM ↔ ERP</div>
        <h1>Deal Record — PO discrepancy</h1>
        <p className="disclaimer">
          Synthetic ops demo: reconcile a Closed Won <strong>CRM</strong> deal amount to
          the <strong>ERP</strong> purchase order before more spend locks in. No live
          CRM/ERP credentials — Northwind-style demo data only.
        </p>

        <section className="case-block">
          <h2>Context</h2>
          <p>
            Sales closed an 8 MW / $4.8M colo deal in the CRM. Procurement only sees a
            Phase 1 ERP sales order and PO for 5 MW / $3.2M. Finance, FP&A, and the
            customer each believe a different number.
          </p>
        </section>

        <section className="case-block">
          <h2>Problem</h2>
          <p>
            <strong>$1.6M PO discrepancy</strong> between CRM closed-won amount and ERP
            issued PO. Expansion MW lived as “committed” in CRM, never as a priced PO
            line in ERP — so remaining buy is either overstated or blocked.
          </p>
        </section>

        <section className="case-block">
          <h2>User</h2>
          <p>
            Deal owners, RevOps, and procurement leads who need one project ID that
            surfaces CRM vs ERP conflicts before the next PO goes out.
          </p>
        </section>

        <section className="case-block">
          <h2>What I built</h2>
          <ul>
            <li>
              Featured deal <code style={{ color: "var(--signal)" }}>GE-2026-0422</code>{" "}
              with conflicting load, site, dates, and revenue fields sourced CRM vs ERP.
            </li>
            <li>
              Sourcing tab: ERP <code style={{ color: "var(--signal)" }}>PO-10491</code>{" "}
              at $3.2M flagged against CRM $4.8M; expansion line blocked with no ERP PO.
            </li>
            <li>Spec / sourcing / cost on one project code with explicit conflict status.</li>
          </ul>
        </section>

        <section className="case-block">
          <h2>Guardrails</h2>
          <ul>
            <li>Conflicting CRM/ERP fields stay visible — never silently “confirmed.”</li>
            <li>No further materials PO until deal amount and ERP PO amount match.</li>
            <li>Synthetic Northwind-style customer data only; no live CRM/ERP credentials.</li>
          </ul>
        </section>

        <section className="case-block">
          <h2>Outcome</h2>
          <ul>
            <li>
              Operators open the deal and immediately see the CRM↔ERP PO gap before
              margin or supplier commit is wrong.
            </li>
            <li>
              Live:{" "}
              <a
                href="https://selvera247.github.io/demo-interview--app/#/projects/deal-record"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--signal)" }}
              >
                /#/projects/deal-record
              </a>
            </li>
          </ul>
        </section>

        <section className="case-block">
          <h2>Stack</h2>
          <div className="stack-list">
            {["React", "Vite", "TypeScript", "CRM↔ERP recon", "seeded PO flags"].map(
              (s) => (
                <span key={s}>{s}</span>
              )
            )}
          </div>
        </section>
      </article>

      <div id="live-app">
        <App />
      </div>
    </div>
  );
}
