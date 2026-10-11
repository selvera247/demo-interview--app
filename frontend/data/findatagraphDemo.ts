/**
 * Backend origin for the FinDataGraph control plane (API + web).
 * Prefer a durable finance host (Render) when available; quick tunnels are ephemeral.
 * Override at build time with VITE_FINDATAGRAPH_DEMO_URL.
 */
export const FINDATAGRAPH_DEMO_URL =
  import.meta.env.VITE_FINDATAGRAPH_DEMO_URL ||
  "https://profiles-singles-pct-hansen.trycloudflare.com";

/** In-portfolio launch path — keeps the address bar on a finance-named Pages route. */
export const FINDATAGRAPH_DEMO_ROUTE = "/projects/findatagraph/demo";

/** Probe the control plane so the iframe shell can show an offline state. */
export async function probeFinDataGraphHealth(
  origin: string = FINDATAGRAPH_DEMO_URL,
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
      return { ok: false, detail: "Health check timed out — demo backend unreachable." };
    }
    return {
      ok: false,
      detail:
        "Demo backend unreachable (expired Cloudflare tunnel or host down).",
    };
  } finally {
    window.clearTimeout(timer);
  }
}
