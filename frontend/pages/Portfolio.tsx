import { Link } from "react-router-dom";

/** HashRouter-safe in-page scroll (plain #anchors break the #/ route on GitHub Pages). */
function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const closeProposals = [
  {
    kind: "Flux",
    title: "Cloud hosting MoM variance",
    detail:
      "Illustrative +$85K on ND-US 6110 — agent cites duplicate accrual twin vs baseline run rate.",
    confidence: "High",
  },
  {
    kind: "Accrual",
    title: "Contractor reclass suggestion",
    detail:
      "Propose paired JEs moving ND-EU contractors → professional fees with memo lineage.",
    confidence: "Med",
  },
  {
    kind: "Recon",
    title: "AR vs revenue timing flag",
    detail:
      "Quarter-boundary pull-forward on Northwind Labs Analytics renewal — low confidence residual.",
    confidence: "Low",
  },
];

const dealEvents = [
  {
    when: "Day 0",
    title: "Pricing exception filed",
    detail: "Controller holds Phase-2 expansion until SO/PO matches opportunity amount.",
  },
  {
    when: "Day 2",
    title: "RevOps approval",
    detail: "Exception reviewed; CRM Closed Won ≠ authority to buy without ERP match.",
  },
  {
    when: "Day 5",
    title: "Change history updated",
    detail: "Deal Record logs amount/MW drift and blocks further auto-PO.",
  },
];

const measureItems = [
  {
    metric: "Close duration",
    note: "Calendar days from period end to package sign-off (illustrative target band).",
  },
  {
    metric: "Manual touches per recon",
    note: "Human edits required before a recon item clears the gate.",
  },
  {
    metric: "Exception rate",
    note: "Share of agent proposals rejected or sent back for revision.",
  },
];

const playbook = [
  {
    day: "0–30",
    title: "Discovery",
    points: [
      "Shadow one close and one deal desk; capture real policies and thresholds.",
      "Map systems (ERP / Billing / CRM) with generic labels only.",
      "Agree human-gate rules and what must never auto-post.",
    ],
  },
  {
    day: "31–60",
    title: "Pilot",
    points: [
      "Stand up synthetic twin of Northwind Labs close + one Deal Record path.",
      "Run planted anomalies through review queue; tune confidence cutoffs.",
      "Controllers approve / edit / reject in the room — no silent writes.",
    ],
  },
  {
    day: "61–90",
    title: "Scale",
    points: [
      "Generalize MCP tools and audit schema across entities.",
      "Add eval harness before wider rollout; keep low-confidence in review.",
      "Hand off runbooks; forward-deployed support during first live close.",
    ],
  },
];

export default function Portfolio() {
  return (
    <>
      <nav className="site-nav">
        <Link to="/" className="brand">
          Chris Selvera
        </Link>
        <div className="nav-links">
          <button type="button" className="linkish" onClick={() => scrollToSection("demo-close")}>
            Close Agent
          </button>
          <button type="button" className="linkish" onClick={() => scrollToSection("demo-deal")}>
            Deal Record
          </button>
          <button type="button" className="linkish" onClick={() => scrollToSection("governance")}>
            Governance
          </button>
          <button type="button" className="linkish" onClick={() => scrollToSection("playbook")}>
            Playbook
          </button>
          <button type="button" className="linkish" onClick={() => scrollToSection("about")}>
            About
          </button>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-visual" aria-hidden="true" />
        <div className="hero-inner">
          <p className="hero-kicker">Northwind Labs · synthetic portfolio</p>
          <h1 className="hero-brand">Finance Transformation, AI-native</h1>
          <p className="hero-headline">Governed AI tools for finance teams</p>
          <p className="hero-support">
            One fictional mid-size company — Northwind Labs — so demos stay synthetic,
            auditable, and safe to share.
          </p>
          <div className="hero-badge-row">
            <span className="synth-badge">100% synthetic data</span>
          </div>
          <div className="hero-cta">
            <Link className="btn btn-primary" to="/projects/close-agent">
              Run Close Agent
            </Link>
            <Link className="btn btn-ghost" to="/projects/deal-record">
              Open Deal Record
            </Link>
          </div>
        </div>
      </header>

      <section className="section" id="demo-close">
        <div className="tag">Demo 1 · Governed Close Agent (MCP)</div>
        <h2>Month-end close for Northwind Labs</h2>
        <p className="lede">
          A fictional close walkthrough: the agent proposes, a human gates every
          consequential item, and an audit trail records who / what / when / why.
          Figures below are illustrative only.
        </p>

        <div className="demo-triptych">
          <article className="demo-panel">
            <h3>Agent proposes</h3>
            <ul className="demo-item-list">
              {closeProposals.map((p) => (
                <li key={p.title}>
                  <div className="demo-item-head">
                    <span className="pill">{p.kind}</span>
                    <span className="pill pill-muted">{p.confidence}</span>
                  </div>
                  <strong>{p.title}</strong>
                  <p>{p.detail}</p>
                </li>
              ))}
            </ul>
          </article>

          <article className="demo-panel">
            <h3>Human gate</h3>
            <p className="demo-panel-lede">
              Approve, reject, or edit each draft before it enters the flux package.
              Low confidence never auto-posts.
            </p>
            <div className="gate-row">
              <span className="gate-chip gate-approve">Approve</span>
              <span className="gate-chip gate-edit">Edit</span>
              <span className="gate-chip gate-reject">Reject</span>
            </div>
            <p className="demo-panel-note">
              Illustrative queue: 3 open items · 1 forced to review (low confidence).
            </p>
          </article>

          <article className="demo-panel">
            <h3>Audit trail</h3>
            <ol className="audit-list">
              <li>
                <span>Casey Controller</span>
                <span>Approved flux draft · 6110</span>
                <span>why: citation matched JE twin</span>
              </li>
              <li>
                <span>Casey Controller</span>
                <span>Edited accrual memo</span>
                <span>why: clarify reclass entity</span>
              </li>
              <li>
                <span>System</span>
                <span>Queued low-confidence recon</span>
                <span>why: residual below policy cutoff</span>
              </li>
            </ol>
          </article>
        </div>

        <div className="hero-cta" style={{ marginTop: "1.5rem" }}>
          <Link className="btn btn-primary" to="/projects/close-agent">
            Run Close Agent
          </Link>
        </div>
      </section>

      <section className="section" id="demo-deal">
        <div className="tag">Demo 2 · Deal Record</div>
        <h2>One deal ID across the commercial chain</h2>
        <p className="lede">
          Northwind Labs fictional deal with approvals, pricing exceptions, and a change
          history — so opportunity / contract / sales order / PO cannot drift quietly.
        </p>

        <div className="deal-story">
          <div className="deal-story-main">
            <div className="illustrative-label">Illustrative deal · NL-2026-0411</div>
            <h3>Analytics expansion · Phase 2 hold</h3>
            <p>
              Pricing exception: CRM implies broader scope than ERP sales order + PO.
              Approvals and change history stay on one Deal Record before the next buy.
            </p>
            <ul className="deal-meta">
              <li>Approvals: RevOps → Controller</li>
              <li>Exception: pricing / scope mismatch</li>
              <li>History: amount &amp; MW fields never silently “fixed”</li>
            </ul>
          </div>
          <ol className="deal-timeline">
            {dealEvents.map((e) => (
              <li key={e.title}>
                <span className="deal-when">{e.when}</span>
                <strong>{e.title}</strong>
                <p>{e.detail}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="hero-cta" style={{ marginTop: "1.5rem" }}>
          <Link className="btn btn-primary" to="/projects/deal-record">
            Open Deal Record
          </Link>
        </div>

        <p className="tertiary-link">
          Also available:{" "}
          <Link to="/projects/findatagraph">FinDataGraph</Link> — continuous close control
          plane (CRM↔GL matching) over synthetic data.
        </p>
      </section>

      <section className="section" id="governance">
        <div className="tag">Operating model</div>
        <h2>How it’s governed</h2>
        <p className="lede">
          Permissions, human-in-the-loop checkpoints, and logging on one screen — the
          pattern that makes controllers trust an AI-assisted close.
        </p>

        <div className="gov-diagram" aria-label="Governance flow diagram">
          <div className="gov-node">
            <span className="gov-step">1</span>
            <h3>Permissions</h3>
            <p>Roles scoped by entity. Tools callable only with policy thresholds from YAML.</p>
          </div>
          <div className="gov-arrow" aria-hidden="true">
            →
          </div>
          <div className="gov-node">
            <span className="gov-step">2</span>
            <h3>Human checkpoints</h3>
            <p>Approve / edit / reject on every consequential draft. Low confidence forced here.</p>
          </div>
          <div className="gov-arrow" aria-hidden="true">
            →
          </div>
          <div className="gov-node">
            <span className="gov-step">3</span>
            <h3>Logging</h3>
            <p>Who, what, when, why — tool calls, edits, and decisions in an append-only trail.</p>
          </div>
        </div>
      </section>

      <section className="section" id="measure">
        <div className="tag">Metrics · illustrative thinking</div>
        <h2>What I’d measure</h2>
        <p className="lede">
          No “saved X days” claims. These are the dials I’d instrument on a Northwind Labs
          pilot — labels only, not disclosed employer outcomes.
        </p>
        <div className="measure-grid">
          {measureItems.map((m) => (
            <div key={m.metric} className="measure-card">
              <strong>{m.metric}</strong>
              <p>{m.note}</p>
            </div>
          ))}
        </div>
        <p className="illustrative-footnote">
          Any sample figures elsewhere in the demos are fictional and labeled illustrative /
          synthetic.
        </p>
      </section>

      <section className="section" id="playbook">
        <div className="tag">Rollout</div>
        <h2>Playbook · 30 / 60 / 90</h2>
        <p className="lede">
          How I’d stand this up at a new company — discovery, pilot, scale. No outcome
          numbers.
        </p>
        <div className="playbook-grid">
          {playbook.map((phase) => (
            <article key={phase.day} className="playbook-card">
              <div className="playbook-day">{phase.day}</div>
              <h3>{phase.title}</h3>
              <ul>
                {phase.points.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="about">
        <div className="tag">About</div>
        <h2>Chris Selvera</h2>
        <p className="lede">
          Forward-deployed finance engineer. I sit with controllers and deal owners, then
          build governed agents and workflows — evidence, human gates, and audit trails
          before anything consequential ships.
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
          <Link className="btn btn-ghost" to="/projects/findatagraph">
            FinDataGraph
          </Link>
        </div>
      </section>

      <footer className="site-footer site-footer-strong">
        <span>Built independently with synthetic data. No employer information.</span>
        <span>
          <a href="https://selvera247.github.io/demo-interview--app/#/">GitHub Pages</a>
          {" · "}
          Northwind Labs fictional demos
        </span>
      </footer>
    </>
  );
}
