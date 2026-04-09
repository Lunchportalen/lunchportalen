import type { OmniscientState } from "@/lib/ai/omniscientContext";

export type RevenueInsights = {
  revenuePerUser: number;
  ltvToCac: number;
  conversionEfficiency: number;
  growthQuality: number;
};

/**
 * Deterministic revenue metrics from omniscient state — analysis only, no writes.
 */
export function analyzeRevenue(state: OmniscientState): RevenueInsights {
  const traffic = Math.max(state.traffic, 1);
  const cac = Math.max(state.cac, 1);
  return {
    revenuePerUser: state.revenue / traffic,
    ltvToCac: state.ltv / cac,
    conversionEfficiency: state.conversion * state.avgOrderValue,
    growthQuality: state.growthRate * (1 - state.churn),
  };
}
