import "server-only";

import { getBusinessMetrics } from "@/lib/ai/businessMetrics";

/**
 * Deterministic market snapshot derived from existing business metrics (no external competitor APIs).
 * `competitors` stays empty until an explicit feed exists — {@link analyzeCompetitors} then emits NO_COMPETITOR_DATA.
 * `priceIndex` is a bounded heuristic from conversion/churn (suggest-only pricing sims, never applied).
 */
export type MarketMetricsSnapshot = {
  competitors: string[];
  marketTraffic: number;
  demandSignals: string[];
  priceIndex: number;
  growthRate: number;
};

export async function getMarketMetrics(): Promise<MarketMetricsSnapshot> {
  const m = await getBusinessMetrics();
  const demandSignals: string[] = [];
  if (m.conversionRate > 0.03) {
    demandSignals.push("STRONG_CONVERSION");
  }
  if (m.runningExperimentsCount > 0) {
    demandSignals.push("ACTIVE_EXPERIMENTATION");
  }
  const rawIndex = 1 + m.churnRate - m.conversionRate;
  const priceIndex = Math.min(1.5, Math.max(0.5, Number.isFinite(rawIndex) ? rawIndex : 1));
  return {
    competitors: [],
    marketTraffic: m.eventRowsSampled,
    demandSignals,
    priceIndex,
    growthRate: m.revenueGrowth,
  };
}
