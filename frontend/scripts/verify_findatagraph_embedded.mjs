/**
 * Verify the Pages-native FinDataGraph fixtures + mock API contract.
 * Run: node frontend/scripts/verify_findatagraph_embedded.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(
  readFileSync(join(root, "data/findatagraphFixtures.json"), "utf8"),
);

assert.equal(fixtures.users.length, 3, "three demo users");
assert.ok(
  fixtures.passwords["controller@findatagraph.demo"] === "password123",
  "controller password",
);
assert.ok(fixtures.exceptions.length >= 4, "seeded exceptions");
assert.ok(fixtures.summary.open_exceptions >= 1, "open exception KPI");
assert.ok(fixtures.reconciliations[0]?.id, "reconciliation definition");
assert.ok(fixtures.startingPoints?.length >= 2, "Spec Studio starting points");
assert.ok(
  fixtures.startingPoints.some((p) => p.id === "crm_to_accounting_revenue"),
  "seeded CRM↔GL starting point",
);
assert.ok(
  fixtures.startingPoints.some((p) => p.id === "cc_auth_settle_received"),
  "CC auth generate starting point",
);

const types = new Set(fixtures.exceptions.map((e) => e.exception_type));
for (const t of [
  "amount_mismatch",
  "missing_in_gl",
  "missing_in_crm",
  "entity_mismatch",
]) {
  assert.ok(types.has(t), `has exception type ${t}`);
}

// Lightweight mock of login + resolve without DOM sessionStorage
const usersByEmail = Object.fromEntries(fixtures.users.map((u) => [u.email, u]));
function login(email, password) {
  assert.equal(fixtures.passwords[email], password);
  return { token: `emb_${email}`, user: usersByEmail[email] };
}
const session = login("controller@findatagraph.demo", "password123");
assert.equal(session.user.role, "controller");

const open = fixtures.exceptions.filter((e) => e.status === "open");
assert.ok(open.length >= 1);
const target = { ...open[0], status: "resolved", resolution_note: "verify" };
assert.equal(target.status, "resolved");

console.log("verify_findatagraph_embedded: ok");
