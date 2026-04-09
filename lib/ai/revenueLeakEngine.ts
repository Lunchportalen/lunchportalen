import type { BusinessState } from "@/lib/ai/businessStateEngine";

/**
 * Deterministic revenue / funnel leak tags. Suggestions only — no writes.
 */
export function detectRevenueLeaks(state: BusinessState): string[] {
  const leaks: string[] = [];
  if (state.conversion < 0.02) leaks.push("LOW_CONVERSION");
  if (state.churn > 0.05) leaks.push("HIGH_CHURN");
  if (state.cac > state.ltv) leaks.push("NEGATIVE_UNIT_ECONOMICS");
  if (state.traffic > 1000 && state.conversion < 0.015) leaks.push("TRAFFIC_NOT_MONETIZED");
  return leaks;
}
