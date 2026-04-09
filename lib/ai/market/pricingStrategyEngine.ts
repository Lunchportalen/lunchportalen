/**
 * Simulation only — suggestions are never auto-applied (filtered out before any executor).
 */

import type { MarketContext } from "@/lib/ai/market/marketContext";
import type { MarketPosition } from "@/lib/ai/market/positioningEngine";

export type PricingSimulationSuggestion =
  | { type: "DECREASE_PRICE"; delta: number }
  | { type: "INCREASE_PRICE"; delta: number };

export function simulatePricing(
  _state: { position: MarketPosition },
  market: Pick<MarketContext, "priceIndex">,
): PricingSimulationSuggestion[] {
  const suggestions: PricingSimulationSuggestion[] = [];
  if (market.priceIndex > 1.2) {
    suggestions.push({ type: "DECREASE_PRICE", delta: 5 });
  }
  if (market.priceIndex < 0.8) {
    suggestions.push({ type: "INCREASE_PRICE", delta: 5 });
  }
  return suggestions;
}
