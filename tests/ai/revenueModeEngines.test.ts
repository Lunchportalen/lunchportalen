import { describe, expect, test } from "vitest";

import { validateRevenueAction } from "@/lib/ai/automationEngine";
import { detectMonetizationGaps } from "@/lib/ai/monetizationGapEngine";
import { generateOffers } from "@/lib/ai/offerEngine";
import { simulatePricingAdvanced } from "@/lib/ai/pricingSimulationEngine";
import { buildOmniscientContextSync } from "@/lib/ai/omniscientContext";
import {
  decideRevenueActions,
  toSingularityActionsFromRevenueOffers,
} from "@/lib/ai/revenueDecisionEngine";
import { analyzeRevenue } from "@/lib/ai/revenueIntelligenceEngine";

function baseState() {
  return buildOmniscientContextSync({
    revenue: 1000,
    mrr: 0,
    conversion: 0.01,
    traffic: 500,
    churn: 0.02,
    cac: 10,
    ltv: 50,
    experiments: 0,
    avgOrderValue: 80,
    growthRate: 0.05,
    margin: 0,
    topPages: [],
    worstPages: [],
    channels: [],
  });
}

describe("revenue mode engines", () => {
  test("analyzeRevenue returns finite metrics", () => {
    const i = analyzeRevenue(baseState());
    expect(Number.isFinite(i.revenuePerUser)).toBe(true);
    expect(Number.isFinite(i.ltvToCac)).toBe(true);
    expect(Number.isFinite(i.conversionEfficiency)).toBe(true);
    expect(Number.isFinite(i.growthQuality)).toBe(true);
  });

  test("simulatePricingAdvanced returns four scenarios", () => {
    const sims = simulatePricingAdvanced(baseState());
    expect(sims).toHaveLength(4);
  });

  test("decideRevenueActions prepends pricing experiment then offers", () => {
    const sims = simulatePricingAdvanced(baseState());
    const offers = generateOffers(baseState());
    const actions = decideRevenueActions(sims, offers);
    expect(actions[0]?.type).toBe("RUN_PRICING_EXPERIMENT");
    expect(actions.some((a) => a.type === "CREATE_OFFER")).toBe(true);
  });

  test("validateRevenueAction blocks pricing experiment and price types", () => {
    expect(validateRevenueAction({ type: "RUN_PRICING_EXPERIMENT" })).toBe(false);
    expect(validateRevenueAction({ type: "INCREASE_PRICE" })).toBe(false);
    expect(validateRevenueAction({ type: "DECREASE_PRICE" })).toBe(false);
    expect(validateRevenueAction({ type: "CREATE_OFFER" })).toBe(true);
  });

  test("toSingularityActionsFromRevenueOffers maps CREATE_OFFER only", () => {
    const actions = decideRevenueActions(simulatePricingAdvanced(baseState()), [
      "DISCOUNT_ENTRY_OFFER",
      "BUNDLE_PRODUCTS",
    ]);
    const sing = toSingularityActionsFromRevenueOffers(actions.filter((a) => validateRevenueAction(a)));
    expect(sing.map((s) => s.type).sort()).toEqual(["experiment", "variant"]);
  });

  test("detectMonetizationGaps and generateOffers", () => {
    const s = baseState();
    expect(detectMonetizationGaps(s).length).toBeGreaterThanOrEqual(1);
    expect(generateOffers(s).length).toBeGreaterThanOrEqual(1);
  });
});
