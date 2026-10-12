/** HashRouter base for the Pages-native FinDataGraph demo. */
export const FDG_DEMO_BASE = "/projects/findatagraph/demo";

export function fdgPath(suffix = ""): string {
  if (!suffix || suffix === "/") return FDG_DEMO_BASE;
  return `${FDG_DEMO_BASE}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
}
