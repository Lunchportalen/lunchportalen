import type { OmniscientState } from "@/lib/ai/omniscientContext";

export type MarketSimulationType = "PRICE_UP" | "PRICE_DOWN" | "FUNNEL_OPTIMIZATION";

export type MarketSimulation = {
  type: MarketSimulationType;
  expectedConversion: number;
  expectedRevenue: number;
};

/**
 * Deterministic what-if scenarios — simulation only, never applied as pricing or prod changes.
 */
export function simulateMarket(state: OmniscientState): MarketSimulation[] {
  return [
    {
      type: "PRICE_UP",
      expectedConversion: state.conversion * 0.9,
      expectedRevenue: state.revenue * 1.1,
    },
    {
      type: "PRICE_DOWN",
      expectedConversion: state.conversion * 1.2,
      expectedRevenue: state.revenue * 0.95,
    },
    {
      type: "FUNNEL_OPTIMIZATION",
      expectedConversion: state.conversion * 1.3,
      expectedRevenue: state.revenue * 1.25,
    },
  ];
}
