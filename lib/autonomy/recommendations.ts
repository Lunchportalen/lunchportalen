/**
 * Deterministic recommendation candidates from metrics (no I/O).
 * Does not apply — use `safety` + `apply` before any action.
 */

import type { AutonomyMetrics, AutonomyRecommendationAction } from "@/lib/autonomy/recommendationsTypes";

export { type AutonomyRecommendationAction } from "@/lib/autonomy/recommendationsTypes";

export function generateRecommendations(metrics: AutonomyMetrics): AutonomyRecommendationAction[] {
  const actions: AutonomyRecommendationAction[] = [];

  if (metrics.conversionRate < 0.02) {
    actions.push({
      type: "pricing_adjustment",
      change: "-5%",
      reason: "Low conversion",
    });
  }

  if (metrics.orders === 0) {
    actions.push({
      type: "activate_ads",
      reason: "No demand",
    });
  }

  return actions;
}
