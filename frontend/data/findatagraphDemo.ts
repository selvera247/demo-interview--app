/**
 * FinDataGraph public demo lives entirely on GitHub Pages.
 * The control plane is an in-browser mock of the Express API (synthetic fixtures).
 * Optional external host override is retained for local pairing with selvera247/agent.
 */
export const FINDATAGRAPH_DEMO_URL =
  import.meta.env.VITE_FINDATAGRAPH_DEMO_URL || "";

/** Public demo URL visitors should use (GitHub Pages HashRouter path). */
export const FINDATAGRAPH_PUBLIC_DEMO_HREF =
  "https://selvera247.github.io/demo-interview--app/#/projects/findatagraph/demo";

/** In-portfolio launch path — keeps the address bar on a finance-named Pages route. */
export const FINDATAGRAPH_DEMO_ROUTE = "/projects/findatagraph/demo";
