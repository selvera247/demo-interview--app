#!/usr/bin/env node
/**
 * Verify Workato-shaped recipe JSON + gap math for Deal Record demo.
 * Run: node frontend/scripts/verify_workato_recipe.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = JSON.parse(
  readFileSync(join(root, "data/workatoExceptionRecipe.json"), "utf8"),
);

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const recipe = raw.recipe;
const p = recipe.sample_payload;
const gapAmt = p.crm_amount_usd - p.erp_amount_usd;
const gapMw = p.crm_mw - p.erp_mw;

assert(raw.disclaimer.includes("SYNTHETIC"), "disclaimer must say SYNTHETIC");
assert(
  raw.disclaimer.toLowerCase().includes("not a live workato"),
  "disclaimer must deny live Workato",
);
assert(recipe.project_id === "GE-2026-0422", "project_id mismatch");
assert(gapAmt === 1_600_000, `gap amount expected 1600000, got ${gapAmt}`);
assert(gapMw === 3, `gap MW expected 3, got ${gapMw}`);
assert(
  recipe.outcome.gap_amount_usd === gapAmt,
  "outcome gap must match payload math",
);
assert(recipe.steps.length >= 5, "recipe needs enough steps");
assert(
  recipe.steps.some((s) => s.id === "upsert_deal_record"),
  "missing Deal Record upsert step",
);
assert(
  raw.failure_scenario.fail_at_step_id === "fetch_erp",
  "failure scenario must fail at ERP fetch",
);
assert(
  raw.failure_scenario.outcome.status === "human_queue",
  "failure must route to human_queue",
);
assert(
  raw.close_agent_parallel?.close_use,
  "close_agent_parallel.close_use required",
);

console.log("OK verify_workato_recipe.mjs");
console.log(
  `  recipe=${recipe.id} gap=${gapAmt} mw=${gapMw} steps=${recipe.steps.length}`,
);
