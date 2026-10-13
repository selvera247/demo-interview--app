/**
 * FinDataGraph demo wiring for the portfolio.
 *
 * - Public CTAs stay on GitHub Pages (`FINDATAGRAPH_DEMO_ROUTE`).
 * - When the live agent host is reachable, the Pages shell iframes Spec Studio
 *   (`/studio`) so visitors see the latest selvera247/agent build.
 * - When the host is down (ephemeral tunnel), the Pages-native embedded app
 *   (including Spec Studio mock) keeps the demo online.
 *
 * Override host with VITE_FINDATAGRAPH_DEMO_URL (origin only, or …/studio).
 */

const DEFAULT_HOST = "https://electronics-variety-abilities-money.trycloudflare.com";

function normalizeHost(raw: string): string {
  const trimmed = (raw || DEFAULT_HOST).trim().replace(/\/$/, "");
  return trimmed.replace(/\/studio$/i, "");
}

/** Backend origin (API + web). */
export const FINDATAGRAPH_DEMO_HOST = normalizeHost(
  import.meta.env.VITE_FINDATAGRAPH_DEMO_URL || DEFAULT_HOST,
);

/**
 * Live agent host auth mode (selvera247/agent `AUTH_MODE`).
 * Clerk is preferred for client tenancy; local demo login stays via AUTH_ALLOW_LOCAL.
 */
export const FINDATAGRAPH_AUTH_MODE = "clerk";

/** Spec Studio path on the live host (post-login landing in selvera247/agent). */
export const FINDATAGRAPH_LIVE_STUDIO_URL = `${FINDATAGRAPH_DEMO_HOST}/studio`;

/** @deprecated Prefer FINDATAGRAPH_LIVE_STUDIO_URL — kept for older call sites. */
export const FINDATAGRAPH_DEMO_URL = FINDATAGRAPH_LIVE_STUDIO_URL;

/** Public demo URL visitors should use (GitHub Pages HashRouter path). */
export const FINDATAGRAPH_PUBLIC_DEMO_HREF =
  "https://selvera247.github.io/demo-interview--app/#/projects/findatagraph/demo";

/** In-portfolio launch path — keeps the address bar on a finance-named Pages route. */
export const FINDATAGRAPH_DEMO_ROUTE = "/projects/findatagraph/demo";

/** Probe the live control plane so the shell can choose iframe vs embedded. */
export async function probeFinDataGraphHealth(
  origin: string = FINDATAGRAPH_DEMO_HOST,
  timeoutMs = 8000,
): Promise<{ ok: boolean; detail: string }> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${origin.replace(/\/$/, "")}/health`, {
      signal: ctrl.signal,
      mode: "cors",
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, detail: `Health check failed (HTTP ${res.status}).` };
    }
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    if (body && body.ok === false) {
      return { ok: false, detail: "Health endpoint reported not ok." };
    }
    return { ok: true, detail: "online" };
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    if (name === "AbortError") {
      return { ok: false, detail: "Live host timed out — using Pages-native demo." };
    }
    return {
      ok: false,
      detail: "Live host unreachable — using Pages-native Spec Studio demo.",
    };
  } finally {
    window.clearTimeout(timer);
  }
}
