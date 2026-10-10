import { Link } from "react-router-dom";
import App from "../App";

/** Deal Record: one ID across opportunity → contract → sales order → PO. */
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
        <div className="kicker">Case study · Demo 02</div>
        <h1>Deal Record</h1>
        <p className="disclaimer">
          Synthetic ops demo — one project ID that ties the commercial chain together
          when CRM and ERP disagree. Northwind-style data only; generic{" "}
          <strong>CRM</strong> / <strong>ERP</strong> labels.
        </p>

        <section className="case-block">
          <h2>Commercial chain</h2>
          <p className="lede" style={{ marginBottom: "1rem" }}>
            The product is still <strong>Deal Record</strong>. The breakage sits between
            these objects:
          </p>
          <div className="stack-list" aria-label="Commercial object chain">
            {[
              "CRM Opportunity",
              "Contract",
              "ERP Sales Order",
              "Purchase Order",
            ].map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <p style={{ marginTop: "1rem", color: "var(--muted)" }}>
            Featured deal: CRM opportunity Closed Won at <strong>$4.8M / 8 MW</strong> →
            contract signed → ERP sales order <code style={{ color: "var(--signal)" }}>SO-10491</code>{" "}
            and PO <code style={{ color: "var(--signal)" }}>PO-10491</code> only for{" "}
            <strong>$3.2M / 5 MW</strong> Phase 1 → <strong>$1.6M</strong> still “committed”
            in CRM with no matching sales order or PO line.
          </p>
        </section>

        <section className="case-block">
          <h2>Context</h2>
          <p>
            Sales, RevOps, procurement, and FP&A each read a different object: the
            opportunity amount, the contract PDF, the ERP sales order, or the issued PO.
            Without one Deal Record, nobody notices the gap until the next buy or forecast.
          </p>
        </section>

        <section className="case-block">
          <h2>Problem</h2>
          <p>
            Opportunity and contract imply 8 MW / $4.8M. The ERP sales order and PO only
            cover Phase 1 at 5 MW / $3.2M. Expansion lived as “committed” on the
            opportunity, never as a priced SO/PO line — a classic CRM↔ERP discrepancy.
          </p>
        </section>

        <section className="case-block">
          <h2>User</h2>
          <p>
            Deal owners, RevOps, and procurement who need opportunity / contract / sales
            order / PO conflicts on one project code before the next PO goes out.
          </p>
        </section>

        <section className="case-block">
          <h2>What I built</h2>
          <ul>
            <li>
              Featured Deal Record <code style={{ color: "var(--signal)" }}>GE-2026-0422</code>{" "}
              with CRM vs ERP conflicts on load, site, dates, and revenue.
            </li>
            <li>
              Sourcing: ERP PO-10491 ($3.2M) flagged against CRM opportunity $4.8M; expansion
              line blocked (no matching sales order / PO).
            </li>
            <li>Spec → sourcing → cost on one ID so contract scope and PO commit stay linked.</li>
          </ul>
        </section>

        <section className="case-block">
          <h2>Guardrails</h2>
          <ul>
            <li>Opportunity Closed Won ≠ authority to buy until the ERP sales order/PO matches.</li>
            <li>Conflicting CRM/ERP fields stay visible — never silently confirmed.</li>
            <li>Synthetic demo data only; no live CRM/ERP credentials.</li>
          </ul>
        </section>

        <section className="case-block">
          <h2>Outcome</h2>
          <ul>
            <li>
              Operators see opportunity → contract → sales order → PO drift before margin
              or supplier commit is wrong.
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
            {[
              "React",
              "Vite",
              "TypeScript",
              "Opportunity",
              "Contract",
              "Sales order",
              "PO",
            ].map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </section>
      </article>

      <div id="live-app">
        <App />
      </div>
    </div>
  );
}
