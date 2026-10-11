import { useMemo, useState } from "react";
import recipeData from "../data/workatoExceptionRecipe.json";

type StepStatus = "idle" | "running" | "ok" | "fail" | "skipped";

type Scenario = "gap" | "failure";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatUsd(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Pure gap calc — used by the runner and by verify_workato_recipe.mjs */
export function computeCommercialGap(payload: {
  crm_amount_usd: number;
  erp_amount_usd: number;
  crm_mw: number;
  erp_mw: number;
}) {
  return {
    gap_amount_usd: payload.crm_amount_usd - payload.erp_amount_usd,
    gap_mw: payload.crm_mw - payload.erp_mw,
  };
}

/**
 * Interactive Workato-shaped exception recipe runner (synthetic).
 * Not a live Workato workspace — portfolio illustration only.
 */
export default function WorkatoRecipeRunner() {
  const recipe = recipeData.recipe;
  const failure = recipeData.failure_scenario;
  const payload = recipe.sample_payload;
  const gap = useMemo(() => computeCommercialGap(payload), [payload]);

  const [scenario, setScenario] = useState<Scenario>("gap");
  const [running, setRunning] = useState(false);
  const [stepStatus, setStepStatus] = useState<Record<string, StepStatus>>({});
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const outcome =
    scenario === "gap" ? recipe.outcome : failure.outcome;

  function reset() {
    setRunning(false);
    setStepStatus({});
    setActiveStep(null);
    setDone(false);
  }

  async function run() {
    if (running) return;
    setRunning(true);
    setDone(false);
    setStepStatus({});
    setActiveStep(null);

    const failAt = scenario === "failure" ? failure.fail_at_step_id : null;
    let failed = false;

    for (const step of recipe.steps) {
      if (failed) {
        setStepStatus((s) => ({ ...s, [step.id]: "skipped" }));
        continue;
      }
      setActiveStep(step.id);
      setStepStatus((s) => ({ ...s, [step.id]: "running" }));
      await sleep(Math.min(step.duration_ms, 280));

      if (failAt && step.id === failAt) {
        setStepStatus((s) => ({ ...s, [step.id]: "fail" }));
        failed = true;
        setActiveStep(null);
        continue;
      }
      setStepStatus((s) => ({ ...s, [step.id]: "ok" }));
    }

    setActiveStep(null);
    setRunning(false);
    setDone(true);
  }

  function statusLabel(st: StepStatus | undefined) {
    if (!st || st === "idle") return "Pending";
    if (st === "running") return "Running";
    if (st === "ok") return "OK";
    if (st === "fail") return "Failed";
    return "Skipped";
  }

  return (
    <div className="recipe-shell" id="recipe-runner">
      <div className="recipe-toolbar">
        <div>
          <div className="recipe-kicker">{recipeData.label} · synthetic</div>
          <div className="recipe-title">{recipe.name}</div>
          <div className="recipe-meta">
            {recipe.id} · project{" "}
            <code style={{ color: "var(--signal)" }}>{recipe.project_id}</code>
          </div>
        </div>
        <div className="recipe-actions">
          <label className="recipe-scenario">
            Scenario
            <select
              value={scenario}
              disabled={running}
              onChange={(e) => {
                setScenario(e.target.value as Scenario);
                reset();
              }}
            >
              <option value="gap">Gap detected ($1.6M)</option>
              <option value="failure">ERP connector failure</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={running}
            onClick={() => void run()}
          >
            {running ? "Running…" : done ? "Re-run recipe" : "Run recipe"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={running || (!done && Object.keys(stepStatus).length === 0)}
            onClick={reset}
          >
            Reset
          </button>
        </div>
      </div>

      <p className="recipe-disclaimer">{recipeData.disclaimer}</p>

      <div className="recipe-grid">
        <div className="recipe-col">
          <h3>Trigger &amp; payload</h3>
          <p className="recipe-detail">
            <strong>{recipe.trigger.source}</strong> · {recipe.trigger.event}
          </p>
          <p className="recipe-detail">{recipe.trigger.description}</p>
          <dl className="recipe-payload">
            <div>
              <dt>CRM amount</dt>
              <dd>{formatUsd(payload.crm_amount_usd)}</dd>
            </div>
            <div>
              <dt>ERP SO/PO</dt>
              <dd>{formatUsd(payload.erp_amount_usd)}</dd>
            </div>
            <div>
              <dt>Computed gap</dt>
              <dd>
                {formatUsd(gap.gap_amount_usd)} / {gap.gap_mw} MW
              </dd>
            </div>
            <div>
              <dt>Policy</dt>
              <dd>SO/PO match required before buy</dd>
            </div>
          </dl>
        </div>

        <div className="recipe-col">
          <h3>Recipe steps</h3>
          <ol className="recipe-steps">
            {recipe.steps.map((step, i) => {
              const st = stepStatus[step.id] ?? "idle";
              const isActive = activeStep === step.id;
              return (
                <li
                  key={step.id}
                  className={`recipe-step recipe-step--${st}${isActive ? " recipe-step--active" : ""}`}
                >
                  <div className="recipe-step-head">
                    <span className="recipe-step-num">{i + 1}</span>
                    <span className="recipe-step-name">{step.name}</span>
                    <span className={`recipe-step-badge recipe-step-badge--${st}`}>
                      {statusLabel(st)}
                    </span>
                  </div>
                  <div className="recipe-step-sys">
                    {step.system} · {step.action}
                  </div>
                  <p className="recipe-detail">{step.detail}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {done && (
        <div
          className={`recipe-outcome recipe-outcome--${
            outcome.status === "exception_opened" ? "exception" : "queue"
          }`}
        >
          <div className="recipe-outcome-title">Outcome</div>
          <p>{outcome.summary}</p>
          <ul>
            <li>
              Status: <strong>{outcome.status}</strong>
            </li>
            <li>
              Gap: {formatUsd(outcome.gap_amount_usd)}
              {outcome.gap_mw != null ? ` / ${outcome.gap_mw} MW` : ""}
            </li>
            <li>
              Deal Record exception:{" "}
              <strong>{outcome.deal_record_exception ? "yes" : "no"}</strong>
            </li>
            <li>
              Auto-PO blocked:{" "}
              <strong>{outcome.auto_po_blocked ? "yes" : "no"}</strong>
            </li>
            <li>Notified: {outcome.notified.join(", ")}</li>
          </ul>
        </div>
      )}

      {scenario === "failure" && !done && (
        <p className="recipe-detail" style={{ marginTop: "0.75rem" }}>
          {failure.description}
        </p>
      )}
    </div>
  );
}
