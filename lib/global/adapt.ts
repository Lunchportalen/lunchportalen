export type ComboShape = Record<string, unknown>;

/**
 * Marker tilpasning til målmarked (ingen auto-rollout — kun struktur for explainability).
 */
export function adaptForMarket(combo: ComboShape, market: string): ComboShape & { market: string; adjusted: true } {
  return {
    ...combo,
    market: typeof market === "string" ? market.trim() : "",
    adjusted: true,
  };
}
