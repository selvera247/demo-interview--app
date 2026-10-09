import { Link } from "react-router-dom";

const projects = [
  {
    to: "/projects/close-agent",
    tag: "DEMO 01 · MCP · 23/23 EVAL",
    title: "Finance MCP Server + Close Agent",
    blurb:
      "Agent answers close questions and drafts flux commentary over a synthetic GL via MCP — with review queue, audit log, and a 23/23 scored eval set.",
  },
  {
    to: "/projects/deal-record",
    tag: "DEMO 02 · OPS",
    title: "Deal Record",
    blurb:
      "Spec intake, sourcing, and cost tracking on one project ID — built for forward-deployed iteration with operators in the room.",
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
          <button type="button" className="linkish" onClick={() => scrollToSection("contact")}>
            Contact
          </button>
          <button type="button" className="linkish" onClick={() => scrollToSection("resume")}>
            Resume
          </button>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-visual" aria-hidden="true" />
        <div className="hero-inner">
          <h1 className="hero-brand">Chris Selvera</h1>
          <p className="hero-headline">
            Finance Transformation Manager building AI-native tools for finance teams.
          </p>
          <p className="hero-support">
            I’ve run the close, collections, and O2C myself, so I build the automation I
            wish I’d had: from prototype to production, with the users in the room.
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
            <button
              type="button"
              className="btn btn-warm"
              onClick={() => scrollToSection("contact")}
            >
              Contact
            </button>
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
          Each case study covers context, problem, users, what I built, adoption,
          guardrails, outcomes, and a synthetic-data demo.
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

      <section className="section" id="resume">
        <h2>Resume</h2>
        <p className="lede">
          Prefer the case studies for depth; resume PDF can drop into{" "}
          <code style={{ color: "var(--signal)" }}>frontend/public/</code> when you’re
          ready to ship a downloadable file.
        </p>
        <div className="hero-cta">
          <a
            className="btn btn-ghost"
            href="https://github.com/selvera247"
            target="_blank"
            rel="noreferrer"
          >
            GitHub profile
          </a>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => scrollToSection("projects")}
          >
            See projects
          </button>
        </div>
      </section>

      <section className="section" id="contact">
        <h2>Contact</h2>
        <p className="lede">
          Open to forward-deployed / AI-native finance roles where builders sit with
          controllers, not just slide decks.
        </p>
        <div className="hero-cta">
          <a
            className="btn btn-primary"
            href="https://github.com/selvera247"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <Link className="btn btn-ghost" to="/projects/close-agent">
            Close Agent demo
          </Link>
        </div>
      </section>

      <footer className="site-footer">
        <span>Chris Selvera · Finance transformation · AI-native tools</span>
        <span>Demos use synthetic data unless noted</span>
      </footer>
    </>
  );
}
