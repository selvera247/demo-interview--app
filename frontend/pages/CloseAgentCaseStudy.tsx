import { Link } from "react-router-dom";
import CaseCallout from "../components/CaseCallout";
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
          <button
            type="button"
            className="linkish"
            onClick={() =>
              document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Live demo
          </button>
        </div>
      </nav>

      <article className="case-layout">
        <div className="kicker">Case study · Demo 01 · Flagship</div>
        <h1>Finance MCP Server + Close Agent</h1>
        <p className="disclaimer">{demo.disclaimer}</p>

        <section className="case-block">
          <h2>Context</h2>
          <p>
            Controllers and FP&A were drowning in month-end flux packages — high-volume
            MoM variance reviews with inconsistent commentary and no shared audit trail
            when AI drafts entered the workflow. The process still lived in spreadsheets
            and chat.
          </p>
        </section>

        <section className="case-block">
          <h2>Problem</h2>
          <p>
            Manual flux ate analyst hours every close. Duplicate and blank JEs slipped
            through. Early AI drafts hallucinated drivers or couldn’t be reviewed with the
            same rigor as a spreadsheet tie-out. Cost showed up as overtime, reopen
            cycles, and controller distrust of “black box” commentary.
          </p>
        </section>

        <section className="case-block">
          <h2>User</h2>
          <p>
            Corporate controllers, close leads, and FP&A analysts who need thresholded
            variance flags, transaction-cited drafts, and a human approve / edit / reject
            gate before anything lands in the flux package.
          </p>
        </section>

        <section className="case-block">
          <h2>What I built</h2>
          <ul>
            <li>
              Synthetic Northwind Digital finance system (24-month trial balance, AR /
              subledger) with planted anomalies for a realistic close narrative.
            </li>
            <li>
              MCP tool spine: trial balance, account variance, subledger detail, close
              tasks, and flux commentary drafting.
            </li>
            <li>
              FastAPI + LangGraph orchestration over the same spine, plus Streamlit review
              queue and a deterministic 23-case eval harness.
            </li>
          </ul>

          <CaseCallout title="Architecture">
            <ul>
              <li>
                <strong>MCP tools:</strong> get_trial_balance · get_account_variance ·
                get_subledger_detail · list_open_close_tasks · draft_flux_commentary
              </li>
              <li>
                <strong>LangGraph / FastAPI:</strong> extract → flag_and_draft →
                approval_gate → summary
              </li>
              <li>
                <strong>Review surface:</strong> queue + tool-call audit log (timestamp,
                inputs, result)
              </li>
              <li>
                <strong>Trust boundary:</strong> agent never auto-posts; low-confidence or
                high-impact drafts are forced to human review
              </li>
            </ul>
          </CaseCallout>

          <CaseCallout title="Eval (23/23)">
            <ul>
              <li>
                <strong>
                  {(score.accurate)}/{score.cases} cases
                </strong>{" "}
                · pass rate{" "}
                <strong style={{ color: "var(--signal)" }}>
                  {(score.pass_rate * 100).toFixed(0)}%
                </strong>{" "}
                on the heuristic agent
              </li>
              <li>
                Scored on: citation accuracy, driver match, confidence calibration,
                false-positive guards
              </li>
              <li>
                Planted exceptions: duplicate accrual, reclass, revenue timing, unsupported
                JE (low), partial support (med)
              </li>
              <li>
                Misses fed back into the eval set before treating a score as
                publishable
              </li>
            </ul>
          </CaseCallout>
        </section>

        <section className="case-block">
          <h2>How I got it adopted</h2>
          <p>
            Forward-deployed with the close lead: started from their real threshold policy
            (&gt;10% <em>and</em> &gt;$50K), walked three planted exception types in a
            working session, kept the review queue in their language (approve / edit /
            reject), and fed every miss back into the eval set before widening rollout.
            Partnered directly with the close lead as the primary stakeholder; the review
            queue and citation requirement were shaped by their feedback in working
            sessions rather than handed over after the fact.
          </p>
        </section>

        <section className="case-block">
          <h2>From controller priority to sequenced delivery</h2>
          <p>
            Intake started from the close lead’s existing threshold policy and language,
            not a blank feature list. Prioritization followed planted exceptions that
            actually show up in close (duplicate accrual, reclass, revenue timing). Change
            management was the structured review queue and mandatory approve / edit /
            reject — controllers rejected pure chat. Adoption measurement was the eval
            harness itself: citation accuracy, driver match, and confidence calibration
            were scored before widening beyond the first entity.
          </p>
          <CaseCallout title="Sequencing">
            <ol className="seq-list">
              <li>
                <strong>Policy first</strong> — capture real thresholds and exception
                types the close lead already uses.
              </li>
              <li>
                <strong>Review + citations</strong> — queue in controller language; every
                draft cites source txns.
              </li>
              <li>
                <strong>Lock the eval</strong> — planted anomalies scored before treating
                a result as publishable.
              </li>
              <li>
                <strong>Then broaden</strong> — feed misses back before wider entity /
                use-case rollout.
              </li>
            </ol>
          </CaseCallout>
        </section>

        <section className="case-block">
          <h2>Guardrails &amp; Evidence</h2>
          <CaseCallout title="Governance pattern">
            <ul>
              <li>
                Low-confidence drafts are queued for human review — the agent does not
                guess
              </li>
              <li>
                Every MCP tool call is logged with arguments and a result summary
              </li>
              <li>
                Approve / edit / reject is mandatory before commentary is treated as final
              </li>
              <li>
                Final drafts cite source JE / subledger txn IDs — no opaque chat answers
              </li>
            </ul>
          </CaseCallout>
        </section>

        <section className="case-block">
          <h2>Outcome</h2>
          <ul>
            <li>
              Controllers get transaction-cited drafts and an audit trail instead of
              opaque chat answers.
            </li>
            <li>
              Designed so finance users stay in control: low-confidence routes to review;
              approve / edit / reject is mandatory — a finance-engineer pattern where the
              team can inspect, edit, and trust the draft.
            </li>
            <li>
              Eval harness and tool-call audit log treated as reusable primitives so the
              same governance pattern can extend to reconciliations or approval copilots
              without rewriting the spine.
            </li>
            <li>
              Eval:{" "}
              <strong style={{ color: "var(--signal)" }}>
                {(score.pass_rate * 100).toFixed(0)}%
              </strong>{" "}
              ({score.accurate}/{score.cases}) on citation + driver + confidence checks —
              synthetic demo only.
            </li>
            <li>
              Supports portfolio-level outcomes from the floor:{" "}
              <strong>$150K+/yr</strong> contract replaced in-house ·{" "}
              <strong>3 prototypes</strong> to production in 6 months ·{" "}
              <strong>30+ countries</strong> of O2C transformation.
            </li>
          </ul>
        </section>

        <section className="case-block">
          <h2>What broke / Trade-offs</h2>
          <p>
            Early drafts occasionally hallucinated drivers — so citation became mandatory
            and the eval scores driver match, not just “sounds right.” A pure chat
            interface was rejected by controllers — so the demo moved to a structured
            review queue with a mandatory human gate. The public site uses synthetic
            Northwind data so credentials for a real ERP are never required.
          </p>
        </section>

        <section className="case-block">
          <h2>Stack</h2>
          <div className="stack-list">
            {[
              "Python",
              "SQLite",
              "MCP",
              "FastAPI",
              "LangGraph",
              "Streamlit",
              "React",
              "Vite",
              "pytest",
            ].map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </section>

        <section className="case-block" id="demo">
          <h2>Demo / Links</h2>
          <p className="disclaimer" style={{ marginBottom: "1rem" }}>
            Interactive review UI below uses a synthetic export — not a live ERP.
          </p>
          <CloseAgentDemo />
          <ul style={{ marginTop: "1.5rem" }}>
            <li>
              Share:{" "}
              <a
                href="https://selvera247.github.io/demo-interview--app/#/projects/close-agent"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--signal)" }}
              >
                GitHub Pages · Close Agent
              </a>
            </li>
            <li>
              Source:{" "}
              <a
                href="https://github.com/selvera247/demo-interview--app/tree/main/finance-close-agent"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--signal)" }}
              >
                finance-close-agent/
              </a>
            </li>
            <li>
              Local:{" "}
              <code style={{ color: "var(--signal)" }}>
                python generate_data.py && streamlit run ui/review_app.py
              </code>
            </li>
          </ul>
        </section>

        <div className="hero-cta" style={{ marginTop: "2rem" }}>
          <Link className="btn btn-primary" to="/">
            Back home
          </Link>
          <Link className="btn btn-ghost" to="/projects/deal-record">
            Deal Record
          </Link>
        </div>
      </article>
    </>
  );
}
