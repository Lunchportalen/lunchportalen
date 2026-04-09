import type { OmniscientState } from "@/lib/ai/omniscientContext";

export type AdvancedPricingSimulationType =
  | "PRICE_INCREASE_10"
  | "PRICE_DECREASE_10"
  | "BUNDLE_STRATEGY"
  | "PREMIUM_TIER";

export type AdvancedPricingSimulation = {
  type: AdvancedPricingSimulationType;
  expectedConversion: number;
  expectedRevenue: number;
};

/**
 * Advanced pricing / packaging scenarios — simulation only; never applied as live prices.
 */
export function simulatePricingAdvanced(state: OmniscientState): AdvancedPricingSimulation[] {
  return [
    {
      type: "PRICE_INCREASE_10",
      expectedConversion: state.conversion * 0.9,
      expectedRevenue: state.revenue * 1.12,
    },
    {
      type: "PRICE_DECREASE_10",
      expectedConversion: state.conversion * 1.25,
      expectedRevenue: state.revenue * 1.05,
    },
    {
      type: "BUNDLE_STRATEGY",
      expectedConversion: state.conversion * 1.15,
      expectedRevenue: state.revenue * 1.2,
    },
    {
      type: "PREMIUM_TIER",
      expectedConversion: state.conversion * 0.85,
      expectedRevenue: state.revenue * 1.3,
    },
  ];
}
