import { describe, expect, test } from "vitest";

import { validateBusinessAction } from "@/lib/ai/automationEngine";
import { buildBusinessState } from "@/lib/ai/businessStateEngine";
import { decideActions } from "@/lib/ai/businessDecisionEngine";
import { buildGrowthStrategy } from "@/lib/ai/growthStrategyEngine";
import { suggestPricing } from "@/lib/ai/pricingEngine";
import { detectRevenueLeaks } from "@/lib/ai/revenueLeakEngine";

describe("god mode engines", () => {
  test("buildBusinessState maps metrics snapshot fields", () => {
    const state = buildBusinessState({
      revenueGrowth: 0.1,
      conversionRate: 0.02,
      churnRate: 0.01,
      eventRowsSampled: 5000,
      revenueRowsSampled: 100,
      runningExperimentsCount: 2,
    });
    expect(state.revenue).toBe(0.1);
    expect(state.conversion).toBe(0.02);
    expect(state.traffic).toBe(5000);
    expect(state.experiments).toBe(2);
  });

  test("detectRevenueLeaks matches thresholds", () => {
    expect(detectRevenueLeaks(buildBusinessState({ conversion: 0.01, churn: 0, cac: 0, ltv: 1 }))).toContain(
      "LOW_CONVERSION",
    );
    expect(detectRevenueLeaks(buildBusinessState({ churn: 0.06, conversion: 1, cac: 0, ltv: 1 }))).toContain(
      "HIGH_CHURN",
    );
    expect(
      detectRevenueLeaks(buildBusinessState({ traffic: 2000, conversion: 0.01, churn: 0, cac: 0, ltv: 1 })),
    ).toContain("TRAFFIC_NOT_MONETIZED");
  });

  test("suggestPricing is non-empty only at extremes", () => {
    expect(suggestPricing(buildBusinessState({ conversion: 0.06 })).some((p) => p.type === "INCREASE_PRICE")).toBe(
      true,
    );
    expect(suggestPricing(buildBusinessState({ conversion: 0.01 })).some((p) => p.type === "DECREASE_PRICE")).toBe(true);
  });

  test("buildGrowthStrategy includes START_EXPERIMENT when experiments === 0", () => {
    const s = buildGrowthStrategy(buildBusinessState({ experiments: 0 }), []);
    expect(s).toContain("START_EXPERIMENT");
  });

  test("decideActions maps strategy to executable types", () => {
    const a = decideActions(["IMPROVE_RETENTION", "CREATE_NEW_LANDING_PAGES"]);
    expect(a.map((x) => x.type).sort()).toEqual(["optimize", "variant"]);
  });

  test("validateBusinessAction blocks pricing types", () => {
    expect(validateBusinessAction({ type: "experiment" })).toBe(true);
    expect(validateBusinessAction({ type: "INCREASE_PRICE" })).toBe(false);
    expect(validateBusinessAction({ type: "DECREASE_PRICE" })).toBe(false);
  });
});
