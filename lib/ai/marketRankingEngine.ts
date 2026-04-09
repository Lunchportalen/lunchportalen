import type { MarketSimulation } from "@/lib/ai/marketSimulationEngine";

/**
 * Rank by expected revenue descending; tie-break by type for stable ordering.
 */
export function rankMarketMoves(opportunities: MarketSimulation[]): MarketSimulation[] {
  return [...opportunities].sort((a, b) => {
    const dr = b.expectedRevenue - a.expectedRevenue;
    if (dr !== 0) return dr;
    return String(a.type).localeCompare(String(b.type));
  });
}
