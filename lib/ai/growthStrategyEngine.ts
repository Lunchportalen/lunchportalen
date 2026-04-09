import type { BusinessState } from "@/lib/ai/businessStateEngine";

/**
 * High-level strategy tags derived from leaks + state. Explainable; no side effects.
 */
export function buildGrowthStrategy(state: BusinessState, leaks: string[]): string[] {
  const strategy: string[] = [];
  if (leaks.includes("LOW_CONVERSION")) strategy.push("RUN_FUNNEL_EXPERIMENTS");
  if (leaks.includes("HIGH_CHURN")) strategy.push("IMPROVE_RETENTION");
  if (leaks.includes("NEGATIVE_UNIT_ECONOMICS")) strategy.push("IMPROVE_RETENTION");
  if (leaks.includes("TRAFFIC_NOT_MONETIZED")) strategy.push("CREATE_NEW_LANDING_PAGES");
  if (state.experiments === 0) strategy.push("START_EXPERIMENT");
  return strategy;
}
