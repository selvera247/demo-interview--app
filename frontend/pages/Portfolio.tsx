import { Link } from "react-router-dom";

const projects = [
  {
    to: "/projects/close-agent",
    tag: "DEMO 01 · FLAGSHIP · 23/23 EVAL",
    title: "Finance MCP Server + Close Agent",
    blurb:
      "Governed close agent over synthetic GL via MCP — review queue, citations, tool-call audit log, and a 23/23 eval set.",
  },
  {
    to: "/projects/deal-record",
    tag: "DEMO 02 · DEAL RECORD",
    title: "Deal Record",
    blurb:
      "One project ID across opportunity → contract → sales order → PO when CRM Closed Won and ERP PO amounts don’t match ($1.6M gap).",
  },
];

const toolkit = [
  {
    tag: "COLLECTIONS",
    title: "Collections Workbench",
    blurb:
      "Prioritized collector queues and exception handling for O2C — built beside collectors, not as a slideware bot.",
  },
  {
    tag: "REVENUE",
    title: "Revenue reconciliation",
    blurb:
      "Commercial integrity patterns: bookings vs ERP, cutoff risk, and dual-system amounts that fail audit if left unchecked.",
  },
];

/** HashRouter-safe in-page scroll (plain #anchors break the #/ route on GitHub Pages). */
function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Portfolio() {
  return (
    <>
      <nav className="site-nav">
        <Link to="/" className="brand">
          Chris Selvera
        </Link>
        <div className="nav-links">
          <button type="button" className="linkish" onClick={() => scrollToSection("projects")}>
            Projects
          </button>
          <button type="button" className="linkish" onClick={() => scrollToSection("governance")}>
            Governance
          </button>
          <button type="button" className="linkish" onClick={() => scrollToSection("contact")}>
            Contact
          </button>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-visual" aria-hidden="true" />
        <div className="hero-inner">
          <h1 className="hero-brand">Chris Selvera</h1>
          <p className="hero-headline">
            Forward-deployed finance engineer. I sit with controllers and collectors,
            then build the governed agents and workflows I wish I’d had when I ran close,
            collections, and O2C.
          </p>
          <p className="hero-support">
            Prototypes with users in the room — evidence, auditability, and a human gate
            before anything consequential ships. Demos below use{" "}
            <strong style={{ color: "var(--white)" }}>synthetic data</strong> only.
          </p>
          <div className="hero-cta">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => scrollToSection("projects")}
            >
              View projects
            </button>
            <Link className="btn btn-ghost" to="/projects/close-agent">
              Close Agent demo
            </Link>
            <Link className="btn btn-warm" to="/projects/deal-record">
              Deal Record
            </Link>
          </div>
        </div>
      </header>

      <section className="section" aria-label="Headline metrics">
        <h2>Proof from the floor</h2>
        <p className="lede">
          Outcomes from running the work and shipping the tools — not slideware metrics.
        </p>
        <div className="metrics">
          <div className="metric">
            <strong>$150K+/yr</strong>
            <span>contract replaced in-house</span>
          </div>
          <div className="metric">
            <strong>3 prototypes</strong>
            <span>shipped to production in 6 months</span>
          </div>
          <div className="metric">
            <strong>30+ countries</strong>
            <span>of O2C transformation</span>
          </div>
        </div>
      </section>

      <section className="section" id="projects">
        <h2>Projects</h2>
        <p className="lede">
          Case studies use the same structure: context → problem → user → build → adoption
          → guardrails → outcome → trade-offs → stack → demo. All figures are synthetic
          unless noted as portfolio outcomes.
        </p>
        <div className="project-list">
          {projects.map((p) => (
            <Link key={p.to} to={p.to} className="project-row">
              <div>
                <div className="tag">{p.tag}</div>
                <h3>{p.title}</h3>
              </div>
              <p>{p.blurb}</p>
              <span className="btn btn-ghost">Open</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section" id="toolkit" aria-label="Related work">
        <h2>Also in the toolkit</h2>
        <p className="lede">
          Lighter surfaces from the same forward-deployed practice — not full interactive
          demos on this site yet.
        </p>
        <div className="project-list">
          {toolkit.map((p) => (
            <div key={p.title} className="project-row toolkit-row">
              <div>
                <div className="tag">{p.tag}</div>
                <h3>{p.title}</h3>
              </div>
              <p>{p.blurb}</p>
              <span className="btn btn-ghost" style={{ opacity: 0.55, pointerEvents: "none" }}>
                Context
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="governance">
        <h2>Governance pattern</h2>
        <p className="lede">
          Reusable across close, commercial chain, and collections work — the part that
          makes controllers trust the system.
        </p>
        <ul className="governance-list">
          <li>Tool-call audit logging (who called what, with which inputs)</li>
          <li>Mandatory human gate for consequential actions (approve / edit / reject)</li>
          <li>Citations back to source JEs, subledger lines, or commercial objects</li>
          <li>Low-confidence items forced into review — no silent guessing</li>
          <li>Eval harness with planted anomalies before wider rollout</li>
        </ul>
      </section>

      <section className="section" id="prototype">
        <h2>Prototype → production</h2>
        <p className="lede">
          Partnered with Engineering on a path from vibe-coded demos to production: start
          from the user’s real policy, keep evidence and gates, eliminate rework loops.
          Result on the floor: <strong style={{ color: "var(--white)" }}>three
          solutions in six months</strong> — not a graveyard of prototypes.
        </p>
      </section>

      <section className="section" id="contact">
        <h2>Contact</h2>
        <p className="lede">
          Open to forward-deployed finance engineering roles where builders sit with
          controllers and collectors — not just slide decks.
        </p>
        <div className="hero-cta">
          <a
            className="btn btn-primary"
            href="https://github.com/selvera247/demo-interview--app"
            target="_blank"
            rel="noreferrer"
          >
            GitHub repo
          </a>
          <a
            className="btn btn-ghost"
            href="https://finance-portfolio.selveracj.workers.dev"
            target="_blank"
            rel="noreferrer"
          >
            Personal site
          </a>
          <Link className="btn btn-warm" to="/projects/close-agent">
            Close Agent demo
          </Link>
        </div>
      </section>

      <footer className="site-footer">
        <span>Chris Selvera · Forward-deployed finance engineering</span>
        <span>
          Synthetic demos:{" "}
          <a href="https://selvera247.github.io/demo-interview--app/#/">
            GitHub Pages
          </a>
        </span>
      </footer>
    </>
  );
}
