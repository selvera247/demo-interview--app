import { Link } from "react-router-dom";
import CloseAgentDemo from "../components/CloseAgentDemo";
import demo from "../data/closeAgentDemo.json";

export default function CloseAgentCaseStudy() {
  const score = demo.eval_score;

  return (
    <>
      <nav className="site-nav">
        <Link to="/" className="brand">
          Chris Selvera
        </Link>
        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/projects/deal-record">Deal Record</Link>
          <a href="#demo">Live demo</a>
        </div>
      </nav>

      <article className="case-layout">
        <div className="kicker">Case study · Demo 01</div>
        <h1>Finance MCP Server + Close Agent</h1>
        <p className="disclaimer">{demo.disclaimer}</p>

        <section className="case-block">
          <h2>Context</h2>
          <p>
            Close and FP&A teams were drowning in flux packages — high-volume MoM
            variance reviews with inconsistent commentary quality and no shared audit
            trail when AI drafts entered the workflow.
          </p>
        </section>

        <section className="case-block">
          <h2>Problem</h2>
          <p>
            Manual flux ate analyst hours every close, duplicate/manual JEs slipped
            through, and early AI drafts either hallucinated drivers or couldn’t be
            reviewed with the same rigor as a spreadsheet tie-out. Cost showed up as
            overtime, reopen cycles, and controller distrust of “black box” commentary.
          </p>
        </section>

        <section className="case-block">
          <h2>User</h2>
          <p>
            Corporate controllers, close leads, and FP&A analysts who need thresholded
            variance flags, transaction-cited drafts, and a human approve/edit gate
            before anything lands in the flux package.
          </p>
        </section>

        <section className="case-block">
          <h2>What I built</h2>
          <ul>
            <li>
              Synthetic finance system (24-month trial balance, AR/subledger, vendors/
              customers) with planted anomalies for a realistic close narrative.
            </li>
            <li>
              MCP server tools: trial balance, account variance, subledger detail, close
              tasks, and flux commentary drafting.
            </li>
            <li>
              Review queue + tool-call audit log, plus a 19-case eval set scored on
              citation and driver accuracy ({(score.accuracy * 100).toFixed(1)}% on the
              heuristic agent).
            </li>
          </ul>
          <div id="demo">
            <CloseAgentDemo />
          </div>
        </section>

        <section className="case-block">
          <h2>How I got it adopted</h2>
          <p>
            Forward-deployed with the close lead: start from their real threshold policy
            (&gt;10% and &gt;$50K), walk three planted exception types in a working session,
            keep the review queue in their language (approve / edit / reject), and feed
            every miss back into the eval set before widening rollout beyond US-01.
          </p>
        </section>

        <section className="case-block">
          <h2>Guardrails</h2>
          <ul>
            <li>Low-confidence drafts are queued for human review — the agent does not guess.</li>
            <li>Every MCP tool call is logged with arguments and a result summary.</li>
            <li>Approve / edit / reject is mandatory before commentary is treated as final.</li>
            <li>
              Eval harness scores planted variances (duplicate accrual, reclass, revenue
              timing) on citation + explanation match.
            </li>
          </ul>
        </section>

        <section className="case-block">
          <h2>Outcome</h2>
          <ul>
            <li>
              Eval pass rate <strong style={{ color: "var(--signal)" }}>{(score.pass_rate * 100).toFixed(0)}%</strong>{" "}
              ({score.accurate}/{score.cases} cases) with mean accuracy{" "}
              <strong style={{ color: "var(--signal)" }}>{(score.accuracy * 100).toFixed(1)}%</strong>.
            </li>
            <li>
              Portfolio headline outcomes this work supports: <strong>$150K+/yr</strong> contract
              replaced in-house · <strong>3 prototypes</strong> to production in 6 months ·{" "}
              <strong>30+ countries</strong> of O2C transformation.
            </li>
            <li>
              Controllers get transaction-cited drafts and an audit trail instead of
              opaque chat answers.
            </li>
          </ul>
        </section>

        <section className="case-block">
          <h2>Stack</h2>
          <div className="stack-list">
            {[
              "Python",
              "SQLite",
              "MCP",
              "Streamlit",
              "React",
              "Vite",
              "Claude Desktop",
            ].map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </section>

        <section className="case-block">
          <h2>Demo</h2>
          <ul>
            <li>
              Interactive review UI on this page (synthetic export — no live ERP).
            </li>
            <li>
              Local MCP server + Streamlit queue:{" "}
              <code style={{ color: "var(--signal)" }}>finance-close-agent/</code> in this
              repo.
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
            <li>Walkthrough video (60–90s): add link here after recording.</li>
          </ul>
        </section>

        <div className="hero-cta" style={{ marginTop: "2rem" }}>
          <Link className="btn btn-primary" to="/">
            Back home
          </Link>
          <a
            className="btn btn-ghost"
            href="https://github.com/selvera247/demo-interview--app/tree/main/finance-close-agent"
            target="_blank"
            rel="noreferrer"
          >
            View MCP source
          </a>
        </div>
      </article>
    </>
  );
}
