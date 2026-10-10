import { Link } from "react-router-dom";
import App from "../App";

/** Deal Record demo framed as portfolio project #2 with case-study context. */
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
          Synthetic ops demo — one project ID from customer spec through sourcing and
          live margin. Not a real customer system.
        </p>

        <section className="case-block">
          <h2>Context</h2>
          <p>
            Quote-to-cash handoffs broke down when engineering, sourcing, and finance
            each kept their own version of the deal. Spec conflicts showed up late as
            margin erosion and blocked POs.
          </p>
        </section>

        <section className="case-block">
          <h2>Problem</h2>
          <p>
            No single system of record tied customer requirements to BOM/PO status and
            committed cost. Teams re-derived the deal from email, so unresolved fields
            and untagged POs stayed invisible until close.
          </p>
        </section>

        <section className="case-block">
          <h2>User</h2>
          <p>
            Forward-deployed operators and deal owners who need intake → spec → sourcing
            → cost on one project code, with conflicts and open fields visible in the
            room.
          </p>
        </section>

        <section className="case-block">
          <h2>What I built</h2>
          <ul>
            <li>Seeded multi-deal workspace with request basics, impact, and control fields.</li>
            <li>Sourcing view with BOM lock, PO status, and project tagging.</li>
            <li>Cost tracking with quoted vs committed vs actual and live margin.</li>
            <li>Intake panel to add a new deal without leaving the demo.</li>
          </ul>
        </section>

        <section className="case-block">
          <h2>Guardrails</h2>
          <ul>
            <li>Conflicting and TBD fields are explicit — not hidden as “confirmed.”</li>
            <li>Sourcing stays blocked until the BOM is ready; cost activates with a quote.</li>
            <li>All figures are synthetic demo data.</li>
          </ul>
        </section>

        <section className="case-block">
          <h2>Outcome</h2>
          <ul>
            <li>
              Operators see conflicts and margin pressure on one ID before PO spend
              locks in.
            </li>
            <li>
              Live on GitHub Pages:{" "}
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
            {["React", "Vite", "TypeScript", "domain model", "seeded demo state"].map(
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
