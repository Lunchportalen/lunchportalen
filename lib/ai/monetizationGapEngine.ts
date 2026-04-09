import type { OmniscientState } from "@/lib/ai/omniscientContext";

export type MonetizationGapTag = "LOW_FUNNEL_EFFICIENCY" | "LOW_ORDER_VALUE" | "WEAK_LTV";

export function detectMonetizationGaps(state: OmniscientState): MonetizationGapTag[] {
  const gaps: MonetizationGapTag[] = [];
  if (state.traffic > 1000 && state.conversion < 0.02) gaps.push("LOW_FUNNEL_EFFICIENCY");
  if (state.avgOrderValue < 100) gaps.push("LOW_ORDER_VALUE");
  if (state.ltv < state.cac * 2) gaps.push("WEAK_LTV");
  return gaps;
}
