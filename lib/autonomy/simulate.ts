import type { CollectedMetrics } from "@/lib/metrics/collect";
import type { ScoredAutonomyAction } from "@/lib/autonomy/growthTypes";
import type { AutonomyRecommendationAction } from "@/lib/autonomy/recommendationsTypes";

/**
 * Deterministic simulation gate for scored growth actions.
 */
export function simulate(
  action: ScoredAutonomyAction | { type: "price_drop"; change: number },
  _metrics: CollectedMetrics,
): { safe: boolean; expectedLift?: number } {
  void _metrics;
  if (action.type === "price_drop" && typeof action.change === "number" && action.change < -20) {
    return { safe: false };
  }

  return {
    safe: true,
    expectedLift: 0.05,
  };
}

function parsePricingAdjustmentChange(change?: string): number {
  if (!change) return -5;
  const n = Number(String(change).replace(/[^-\d.]/g, ""));
  return Number.isFinite(n) ? n : -5;
}

const emptyMetrics = (): CollectedMetrics => ({
  orders: 0,
  users: 0,
  conversionRate: 0,
  timestamp: Date.now(),
});

/**
 * Legacy boolean gate for recommendation actions (no full metrics in caller).
 */
export function simulateImpact(action: AutonomyRecommendationAction): boolean {
  if (action.type === "pricing_adjustment") {
    const ch = parsePricingAdjustmentChange(action.change);
    return simulate({ type: "price_drop", score: 0, change: ch }, emptyMetrics()).safe;
  }

  if (action.type === "activate_ads") {
    return simulate({ type: "activate_ads", score: 0 }, emptyMetrics()).safe;
  }

  return false;
}
