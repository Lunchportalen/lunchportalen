/**
 * Reads active CMS traffic experiment from layout bootstrap (`window.__LP_VARIANT__` or `lp_exp` cookie).
 * Used so POST /api/orders can attribute `experiment_revenue` to the served variant.
 */
export function getLpExperimentHeadersForFetch(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const w = window as unknown as { __LP_VARIANT__?: { experimentId?: unknown; variantId?: unknown } };
    const v = w.__LP_VARIANT__;
    const experimentId = typeof v?.experimentId === "string" ? v.experimentId.trim() : "";
    const variantId = typeof v?.variantId === "string" ? v.variantId.trim() : "";
    if (experimentId && variantId) {
      return { "x-experiment-id": experimentId, "x-variant-id": variantId };
    }
  } catch {
    /* ignore */
  }
  try {
    const raw = document.cookie.match(/(?:^|; )lp_exp=([^;]*)/);
    const enc = raw?.[1];
    if (!enc) return {};
    const j = JSON.parse(decodeURIComponent(enc)) as { experimentId?: unknown; variantId?: unknown };
    const experimentId = typeof j?.experimentId === "string" ? j.experimentId.trim() : "";
    const variantId = typeof j?.variantId === "string" ? j.variantId.trim() : "";
    if (experimentId && variantId) {
      return { "x-experiment-id": experimentId, "x-variant-id": variantId };
    }
  } catch {
    /* ignore */
  }
  return {};
}
