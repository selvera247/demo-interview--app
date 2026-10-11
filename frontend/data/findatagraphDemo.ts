/**
 * Backend origin for the FinDataGraph control plane (API + web).
 * Prefer a durable finance host (Render) when available; quick tunnels are ephemeral.
 * Override at build time with VITE_FINDATAGRAPH_DEMO_URL.
 */
export const FINDATAGRAPH_DEMO_URL =
  import.meta.env.VITE_FINDATAGRAPH_DEMO_URL ||
  "https://women-contract-sin-gzip.trycloudflare.com";

/** In-portfolio launch path — keeps the address bar on a finance-named Pages route. */
export const FINDATAGRAPH_DEMO_ROUTE = "/projects/findatagraph/demo";
