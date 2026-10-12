/**
 * In-memory FinDataGraph API for the GitHub Pages demo.
 * Same shapes as the Express control plane — no external host required.
 */
import fixtures from "../data/findatagraphFixtures.json";

export type FdgUser = (typeof fixtures.users)[number];
export type FdgException = Omit<
  (typeof fixtures.exceptions)[number],
  "status" | "assignee_id" | "assignee_name" | "resolved_by" | "resolution_note"
> & {
  status: string;
  assignee_id: string | null;
  assignee_name?: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
};
export type FdgAudit = {
  id: string;
  org_id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  payload: Record<string, unknown>;
  created_at: string;
  actor_name: string;
  actor_email: string;
};

type Session = { token: string; user: FdgUser };

const STORAGE_KEY = "findatagraph_embedded_v1";

type Store = {
  exceptions: FdgException[];
  runs: (typeof fixtures.runs)[number][];
  audit: FdgAudit[];
  resolvedLast7: number;
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function loadStore(): Store {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* fresh */
  }
  return {
    exceptions: clone(fixtures.exceptions) as FdgException[],
    runs: clone(fixtures.runs),
    audit: clone(fixtures.audit) as FdgAudit[],
    resolvedLast7: fixtures.summary.resolved_last_7_days,
  };
}

let store = loadStore();

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

function nowStamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function audit(
  actor: FdgUser,
  action: string,
  resource_type: string,
  resource_id: string,
  payload: Record<string, unknown> = {},
) {
  store.audit.unshift({
    id: `aud_${Math.random().toString(16).slice(2, 14)}`,
    org_id: "org_fdg_demo",
    actor_id: actor.id,
    action,
    resource_type,
    resource_id,
    payload,
    created_at: nowStamp(),
    actor_name: actor.name,
    actor_email: actor.email,
  });
}

function scopedExceptions(user: FdgUser): FdgException[] {
  if (user.role === "accountant" && user.entity_ids?.length) {
    const allow = new Set(user.entity_ids);
    return store.exceptions.filter((e) => allow.has(e.entity_id));
  }
  return store.exceptions;
}

function summaryFor(user: FdgUser) {
  const open = scopedExceptions(user).filter((e) => e.status === "open");
  const byTypeMap = new Map<string, number>();
  const byEntityMap = new Map<
    string,
    { entity_code: string; entity_name: string; count: number; variance_abs: number }
  >();
  for (const e of open) {
    byTypeMap.set(e.exception_type, (byTypeMap.get(e.exception_type) || 0) + 1);
    const cur = byEntityMap.get(e.entity_id) || {
      entity_code: e.entity_code,
      entity_name: e.entity_name,
      count: 0,
      variance_abs: 0,
    };
    cur.count += 1;
    cur.variance_abs += Math.abs(Number(e.variance) || 0);
    byEntityMap.set(e.entity_id, cur);
  }
  return {
    open_exceptions: open.length,
    open_variance_abs: open.reduce((s, e) => s + Math.abs(Number(e.variance) || 0), 0),
    resolved_last_7_days: store.resolvedLast7,
    by_type: [...byTypeMap.entries()].map(([exception_type, count]) => ({
      exception_type,
      count,
    })),
    by_entity: [...byEntityMap.values()],
    last_run: store.runs[0] || null,
  };
}

function parseQuery(path: string): { pathname: string; status?: string } {
  const [pathname, qs] = path.split("?");
  const status = qs
    ? new URLSearchParams(qs).get("status") || undefined
    : undefined;
  return { pathname, status };
}

function requireUser(token?: string): FdgUser {
  if (!token || !token.startsWith("emb_")) {
    const err = new Error("Unauthorized");
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  const email = token.slice(4);
  const user = fixtures.users.find((u) => u.email === email);
  if (!user) {
    const err = new Error("Unauthorized");
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  return user;
}

/** Drop-in replacement for the hosted `/api/v1` client. */
export async function api(
  path: string,
  opts: { token?: string; method?: string; body?: unknown } = {},
): Promise<unknown> {
  // Simulate a short network hop so the UI shows loading states.
  await new Promise((r) => setTimeout(r, 40));

  const method = (opts.method || "GET").toUpperCase();
  const { pathname, status } = parseQuery(path);

  if (pathname === "/auth/login" && method === "POST") {
    const body = (opts.body || {}) as { email?: string; password?: string };
    const email = (body.email || "").trim().toLowerCase();
    const expected =
      fixtures.passwords[email as keyof typeof fixtures.passwords];
    const user = fixtures.users.find((u) => u.email === email);
    if (!user || !expected || body.password !== expected) {
      const err = new Error("Invalid email or password");
      (err as Error & { status: number }).status = 401;
      throw err;
    }
    audit(user, "login", "user", user.id);
    persist();
    const session: Session = { token: `emb_${user.email}`, user };
    return session;
  }

  const user = requireUser(opts.token);

  if (pathname === "/auth/me" && method === "GET") {
    return { user };
  }

  if (pathname === "/dashboard/summary" && method === "GET") {
    return summaryFor(user);
  }

  if (pathname === "/exceptions" && method === "GET") {
    let rows = scopedExceptions(user);
    if (status) rows = rows.filter((e) => e.status === status);
    return { data: clone(rows) };
  }

  const exMatch = pathname.match(/^\/exceptions\/([^/]+)$/);
  if (exMatch && method === "GET") {
    const row = scopedExceptions(user).find((e) => e.id === exMatch[1]);
    if (!row) {
      const err = new Error("Exception not found");
      (err as Error & { status: number }).status = 404;
      throw err;
    }
    return { data: clone(row), corrections: [] };
  }

  const assignMatch = pathname.match(/^\/exceptions\/([^/]+)\/assign$/);
  if (assignMatch && method === "POST") {
    const row = store.exceptions.find((e) => e.id === assignMatch[1]);
    if (!row) {
      const err = new Error("Exception not found");
      (err as Error & { status: number }).status = 404;
      throw err;
    }
    const body = (opts.body || {}) as { assignee_id?: string };
    const assignee =
      fixtures.users.find((u) => u.id === body.assignee_id) || user;
    row.assignee_id = assignee.id;
    row.assignee_name = assignee.name;
    row.updated_at = nowStamp();
    audit(user, "assign", "exception", row.id, { assignee_id: assignee.id });
    persist();
    return { data: clone(row) };
  }

  const resolveMatch = pathname.match(/^\/exceptions\/([^/]+)\/resolve$/);
  if (resolveMatch && method === "POST") {
    const row = store.exceptions.find((e) => e.id === resolveMatch[1]);
    if (!row) {
      const err = new Error("Exception not found");
      (err as Error & { status: number }).status = 404;
      throw err;
    }
    const body = (opts.body || {}) as { note?: string };
    row.status = "resolved";
    row.resolved_by = user.id;
    row.resolution_note = body.note || "Resolved in Pages demo";
    row.updated_at = nowStamp();
    store.resolvedLast7 += 1;
    audit(user, "resolve", "exception", row.id, { note: row.resolution_note });
    persist();
    return { data: clone(row) };
  }

  const waiveMatch = pathname.match(/^\/exceptions\/([^/]+)\/waive$/);
  if (waiveMatch && method === "POST") {
    if (user.role === "accountant") {
      const err = new Error("Controller or admin required to waive");
      (err as Error & { status: number }).status = 403;
      throw err;
    }
    const row = store.exceptions.find((e) => e.id === waiveMatch[1]);
    if (!row) {
      const err = new Error("Exception not found");
      (err as Error & { status: number }).status = 404;
      throw err;
    }
    const body = (opts.body || {}) as { note?: string };
    row.status = "waived";
    row.resolved_by = user.id;
    row.resolution_note = body.note || "Waived in Pages demo";
    row.updated_at = nowStamp();
    store.resolvedLast7 += 1;
    audit(user, "waive", "exception", row.id, { note: row.resolution_note });
    persist();
    return { data: clone(row) };
  }

  if (pathname === "/reconciliations" && method === "GET") {
    return { data: clone(fixtures.reconciliations) };
  }

  if (pathname === "/reconciliations/runs" && method === "GET") {
    return { data: clone(store.runs) };
  }

  const runMatch = pathname.match(/^\/reconciliations\/([^/]+)\/runs$/);
  if (runMatch && method === "POST") {
    if (user.role === "accountant") {
      const err = new Error("Controller or admin required to run");
      (err as Error & { status: number }).status = 403;
      throw err;
    }
    const def = fixtures.reconciliations.find((r) => r.id === runMatch[1]);
    if (!def) {
      const err = new Error("Definition not found");
      (err as Error & { status: number }).status = 404;
      throw err;
    }
    const openCount = store.exceptions.filter((e) => e.status === "open").length;
    const run = {
      id: `run_${Math.random().toString(16).slice(2, 14)}`,
      org_id: "org_fdg_demo",
      definition_id: def.id,
      status: "completed",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      triggered_by: user.id,
      matched_count: 4,
      exception_count: openCount,
      error_message: null,
      definition_name: def.name,
      definition_code: def.code,
    };
    store.runs.unshift(run);
    audit(user, "run", "reconciliation", def.id, { run_id: run.id });
    persist();
    return { data: run };
  }

  if (pathname === "/audit" && method === "GET") {
    if (user.role === "accountant") {
      const err = new Error("Controller or admin required");
      (err as Error & { status: number }).status = 403;
      throw err;
    }
    return { data: clone(store.audit) };
  }

  if (pathname === "/entities" && method === "GET") {
    return { data: clone(fixtures.entities) };
  }

  if (pathname === "/users" && method === "GET") {
    return { data: clone(fixtures.users) };
  }

  const err = new Error(`Unknown demo route ${method} ${pathname}`);
  (err as Error & { status: number }).status = 404;
  throw err;
}

/** Reset session demo state (for tests / Retry). */
export function resetFdgDemoStore() {
  sessionStorage.removeItem(STORAGE_KEY);
  store = {
    exceptions: clone(fixtures.exceptions) as FdgException[],
    runs: clone(fixtures.runs),
    audit: clone(fixtures.audit) as FdgAudit[],
    resolvedLast7: fixtures.summary.resolved_last_7_days,
  };
}
