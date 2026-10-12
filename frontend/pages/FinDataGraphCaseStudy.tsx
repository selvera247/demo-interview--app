import { Link } from "react-router-dom";
import CaseCallout from "../components/CaseCallout";
import {
  FINDATAGRAPH_DEMO_ROUTE,
  FINDATAGRAPH_PUBLIC_DEMO_HREF,
} from "../data/findatagraphDemo";

export default function FinDataGraphCaseStudy() {
  return (
    <>
      <nav className="site-nav">
        <Link to="/" className="brand">
          Chris Selvera
        </Link>
        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/projects/close-agent">Close Agent</Link>
          <Link className="linkish" to={FINDATAGRAPH_DEMO_ROUTE}>
            Launch demo
          </Link>
        </div>
      </nav>

      <article className="case-layout">
        <div className="kicker">Case study · Demo 03 · Financial data graph</div>
        <h1>FinDataGraph</h1>
        <p className="disclaimer">
          Continuous close & reconciliation over a governed financial data graph —
          synthetic Meridian Retail data only. Login-gated live demo.
        </p>

        <div className="hero-cta" style={{ margin: "1.25rem 0 2rem" }}>
          <Link className="btn btn-primary" to={FINDATAGRAPH_DEMO_ROUTE}>
            Launch demo
          </Link>
          <Link className="btn btn-ghost" to="/projects/close-agent">
            Close Agent
          </Link>
        </div>

        <section className="case-block">
          <h2>Context</h2>
          <p>
            Controllers still clear CRM revenue vs GL in spreadsheets and email.
            Breaks stay invisible until late in close; “why” questions lack lineage;
            write-backs are ungoverned.
          </p>
        </section>

        <section className="case-block">
          <h2>Problem</h2>
          <p>
            Multi-system extracts (CRM invoices ↔ ERP GL) create amount mismatches,
            missing records, and entity misposts. Without a durable exception store,
            dual-control approvals, and an audit trail, agentic close stays slideware.
          </p>
        </section>

        <section className="case-block">
          <h2>User</h2>
          <p>
            Controllers and entity accountants who need detect → investigate → resolve →
            report with human gates on material actions and evidence Internal Audit can
            follow.
          </p>
        </section>

        <section className="case-block">
          <h2>What I built</h2>
          <ul>
            <li>
              Headless JWT API + React control plane over a financial data graph
              (entities, certified CRM/GL staging, reconciliation defs, exceptions,
              corrections, audit log).
            </li>
            <li>
              CRM invoice ↔ GL revenue matcher that opens typed exceptions (amount,
              missing side, entity mismatch).
            </li>
            <li>
              HITL resolve / waive / correction flow with dual control above $10k and
              immutable audit events.
            </li>
            <li>RBAC: admin / controller / accountant with entity scope.</li>
          </ul>

          <CaseCallout title="Architecture">
            <ul>
              <li>
                <strong>Financial data graph:</strong> org → entities → source systems →
                certified staging → runs → exceptions → corrections → audit
              </li>
              <li>
                <strong>API-first:</strong> web is one client; same contracts for future
                Genie/Cortex/agents
              </li>
              <li>
                <strong>Trust boundary:</strong> material corrections require controller
                approval; every mutation is audited
              </li>
            </ul>
          </CaseCallout>
        </section>

        <section className="case-block">
          <h2>Guardrails &amp; Evidence</h2>
          <CaseCallout title="Governance pattern">
            <ul>
              <li>Login-gated demo (JWT); no anonymous write path</li>
              <li>Entity-scoped visibility for accountants</li>
              <li>Dual control for material corrections (≥ $10,000)</li>
              <li>Append-only audit log: login, runs, assign, resolve, waive, decide</li>
            </ul>
          </CaseCallout>
        </section>

        <section className="case-block">
          <h2>Stack</h2>
          <div className="stack-list">
            {[
              "Node.js",
              "Express",
              "SQLite",
              "React",
              "Vite",
              "JWT",
              "Docker",
              "Render",
            ].map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </section>

        <section className="case-block" id="demo">
          <h2>Demo / Links</h2>
          <p className="disclaimer" style={{ marginBottom: "1rem" }}>
            Live hosted app (API + UI). Synthetic data. Password-gated login. Launch opens
            the finance-named portfolio path (not a random tunnel hostname).
          </p>
          <div className="hero-cta">
            <Link className="btn btn-primary" to={FINDATAGRAPH_DEMO_ROUTE}>
              Launch demo
            </Link>
          </div>
          <ul style={{ marginTop: "1.5rem" }}>
            <li>
              Demo login:{" "}
              <code style={{ color: "var(--signal)" }}>
                controller@findatagraph.demo / password123
              </code>
            </li>
            <li>
              Public demo (stay on GitHub Pages):{" "}
              <Link
                to={FINDATAGRAPH_DEMO_ROUTE}
                style={{ color: "var(--signal)" }}
              >
                /#/projects/findatagraph/demo
              </Link>
            </li>
            <li>
              Share link:{" "}
              <code
                className="fdg-no-autolink"
                style={{ color: "var(--signal)", wordBreak: "break-all" }}
              >
                {FINDATAGRAPH_PUBLIC_DEMO_HREF}
              </code>
            </li>
            <li>
              Source:{" "}
              <code style={{ color: "var(--signal)" }}>selvera247/agent</code>{" "}
              (FinDataGraph MVP). Backend loads inside the Pages shell — not as a
              separate Cloudflare hostname in the address bar.
            </li>
          </ul>
        </section>

        <div className="hero-cta" style={{ marginTop: "2rem" }}>
          <Link className="btn btn-primary" to="/">
            Back home
          </Link>
          <Link className="btn btn-ghost" to="/projects/close-agent">
            Close Agent
          </Link>
          <Link className="btn btn-warm" to="/projects/deal-record">
            Deal Record
          </Link>
        </div>
      </article>
    </>
  );
}
