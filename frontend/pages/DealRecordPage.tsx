import { Link } from "react-router-dom";
import CaseCallout from "../components/CaseCallout";
import WorkatoRecipeRunner from "../components/WorkatoRecipeRunner";
import App from "../App";

/** Deal Record: opportunity → contract → sales order → PO on one ID. */
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
                .getElementById("recipe-runner")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Exception recipe
          </button>
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
          Synthetic ops demo — one project ID across the commercial chain when CRM and
          ERP disagree. Generic <strong>CRM</strong> / <strong>ERP</strong> labels;
          Northwind-style data only.
        </p>

        <section className="case-block">
          <h2>Context</h2>
          <p>
            Sales, RevOps, procurement, and FP&A each read a different object: the CRM
            opportunity, the signed contract, the ERP sales order, or the issued PO.
            Without one Deal Record, drift shows up late as margin miss or a blocked buy.
          </p>
        </section>

        <section className="case-block">
          <h2>Problem</h2>
          <p>
            Opportunity and contract imply <strong>8 MW / $4.8M</strong>. ERP sales order
            SO-10491 and PO-10491 only cover Phase 1 at <strong>5 MW / $3.2M</strong>. The
            remaining <strong>$1.6M / 3 MW</strong> stayed “committed” on the opportunity,
            never as a priced SO/PO line — a CRM↔ERP commercial integrity gap.
          </p>
        </section>

        <section className="case-block">
          <h2>User</h2>
          <p>
            Deal owners, RevOps, and procurement leads who need opportunity / contract /
            sales order / PO conflicts visible on one project code before the next PO
            goes out.
          </p>
        </section>

        <section className="case-block">
          <h2>What I built</h2>
          <ul>
            <li>
              Deal Record for <code style={{ color: "var(--signal)" }}>GE-2026-0422</code>{" "}
              with CRM vs ERP conflicts on load, site, dates, and revenue.
            </li>
            <li>
              Spec → sourcing → cost on one ID so contract scope and PO commit stay linked.
            </li>
            <li>
              Sourcing flags: ERP PO-10491 ($3.2M) vs CRM opportunity ($4.8M); expansion
              line blocked with no matching SO/PO.
            </li>
          </ul>

          <CaseCallout title="Commercial chain">
            <div className="stack-list" style={{ marginBottom: "0.75rem" }}>
              {[
                "CRM Opportunity",
                "Contract",
                "ERP Sales Order",
                "Purchase Order",
              ].map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              Closed Won opportunity + signed contract ≠ authority to buy until the ERP
              sales order and PO match amount and MW.
            </p>
          </CaseCallout>
        </section>

        <section className="case-block">
          <h2>Exception recipe (Workato-shaped)</h2>
          <p>
            When CRM hits Closed Won, a Workato-shaped exception recipe compares
            opportunity / contract amounts to ERP sales order and PO. If they diverge —
            here <strong>$1.6M / 3 MW</strong> — it opens a Deal Record exception, notifies
            RevOps and procurement, and blocks further auto-PO until the systems match.
            Same audit + human-gate discipline as Close Agent; not a live Workato tenant.
          </p>
          <CaseCallout title="Recipe guardrails">
            <ul>
              <li>Trigger: CRM opportunity.closed_won (or nightly CRM↔ERP reconcile)</li>
              <li>
                Never silently overwrite CRM — conflicting fields stay visible on the Deal
                Record
              </li>
              <li>
                Connector failure → human queue with recipe audit log (no invented “match”)
              </li>
              <li>
                Closed Won ≠ authority to buy until SO/PO amounts and MW align
              </li>
            </ul>
          </CaseCallout>
          <WorkatoRecipeRunner />
        </section>

        <section className="case-block">
          <h2>How I got it adopted</h2>
          <p>
            Sat with deal owners and RevOps on a live mismatch: started from the objects
            they already argued about (opportunity vs SO vs PO), kept conflicting fields
            visible instead of “fixing” CRM, and walked the $1.6M gap in a working
            session before any further materials buy.
          </p>
        </section>

        <section className="case-block">
          <h2>Guardrails &amp; Evidence</h2>
          <ul>
            <li>
              Opportunity Closed Won ≠ authority to buy until ERP sales order / PO matches
            </li>
            <li>Conflicting CRM/ERP fields stay visible — never silently confirmed</li>
            <li>
              Expansion BOM blocked when CRM expects spend with no matching ERP PO line
            </li>
            <li>
              Exception recipe audited (recipe id, inputs, gap, outcome); failures route to
              humans — not silent success
            </li>
            <li>Synthetic demo only — no live CRM/ERP/Workato credentials</li>
          </ul>
          <CaseCallout title="What this pattern enables">
            <p style={{ margin: 0 }}>
              Same discipline as revenue recognition / commercial integrity work: one
              system of record across opportunity, contract, sales order, and PO so FP&A
              forecast, procurement commit, and customer expectation can’t diverge quietly.
            </p>
          </CaseCallout>
        </section>

        <section className="case-block">
          <h2>Outcome</h2>
          <ul>
            <li>
              Operators see opportunity → contract → sales order → PO drift before margin
              or supplier commit is wrong.
            </li>
            <li>
              Featured gap is impossible to miss: <strong>$1.6M / 3 MW</strong> expansion
              not in ERP.
            </li>
            <li>
              Workato-shaped recipe makes the detect → exception → notify → block-buy loop
              runnable in the case study (gap path and ERP failure path).
            </li>
          </ul>
        </section>

        <section className="case-block">
          <h2>What broke / Trade-offs</h2>
          <p>
            Treating CRM Closed Won as “done” hid the ERP gap until procurement sized the
            wrong transformer. The trade-off: slower “green” status on the opportunity in
            exchange for an honest Deal Record. Spec conflicts are noisy on purpose —
            silent confirmation was the failure mode.
          </p>
        </section>

        <section className="case-block">
          <h2>Stack</h2>
          <div className="stack-list">
            {[
              "React",
              "Vite",
              "TypeScript",
              "Workato-shaped recipe",
              "Opportunity",
              "Contract",
              "Sales order",
              "PO",
            ].map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </section>

        <section className="case-block">
          <h2>Demo / Links</h2>
          <ul>
            <li>
              Exception recipe runner above (synthetic Workato-shaped steps — Run recipe).
            </li>
            <li>
              Interactive Deal Record app below (opens on Sourcing for the featured gap).
            </li>
            <li>
              Share:{" "}
              <a
                href="https://selvera247.github.io/demo-interview--app/#/projects/deal-record"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--signal)" }}
              >
                GitHub Pages · Deal Record
              </a>
            </li>
            <li>
              Repo:{" "}
              <a
                href="https://github.com/selvera247/demo-interview--app"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--signal)" }}
              >
                selvera247/demo-interview--app
              </a>
            </li>
          </ul>
        </section>
      </article>

      <div id="live-app">
        <App />
      </div>

      <div
        className="hero-cta"
        style={{
          width: "min(860px, calc(100% - 2.5rem))",
          margin: "0 auto 3rem",
        }}
      >
        <Link className="btn btn-primary" to="/">
          Back home
        </Link>
        <Link className="btn btn-ghost" to="/projects/close-agent">
          Close Agent
        </Link>
      </div>
    </div>
  );
}
