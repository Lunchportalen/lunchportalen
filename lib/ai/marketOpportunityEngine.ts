import type { OmniscientState } from "@/lib/ai/omniscientContext";
import type { MarketSimulation } from "@/lib/ai/marketSimulationEngine";

/**
 * Surfaces simulations that beat current modeled revenue (deterministic filter).
 */
export function detectMarketOpportunities(state: OmniscientState, simulations: MarketSimulation[]): MarketSimulation[] {
  const opportunities: MarketSimulation[] = [];
  for (const sim of simulations) {
    if (sim.expectedRevenue > state.revenue) {
      opportunities.push(sim);
    }
  }
  return opportunities;
}
