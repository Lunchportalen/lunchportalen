import { describe, expect, test } from "vitest";

import { validateOmniscientAction } from "@/lib/ai/automationEngine";
import { suggestExpansion } from "@/lib/ai/expansionEngine";
import { detectMarketOpportunities } from "@/lib/ai/marketOpportunityEngine";
import { rankMarketMoves } from "@/lib/ai/marketRankingEngine";
import { simulateMarket } from "@/lib/ai/marketSimulationEngine";
import { buildOmniscientContextSync } from "@/lib/ai/omniscientContext";
import { buildOmniscientFeedForGrowthEngines, decideOmniscientActions } from "@/lib/ai/omniscientDecisionEngine";

describe("omniscient / market engines", () => {
  test("buildOmniscientContextSync maps metrics snapshot", () => {
    const s = buildOmniscientContextSync({
      revenueGrowth: 0.2,
      conversionRate: 0.03,
      churnRate: 0.01,
      eventRowsSampled: 2000,
      runningExperimentsCount: 1,
    });
    expect(s.revenue).toBe(0.2);
    expect(s.growthRate).toBe(0.2);
    expect(s.conversion).toBe(0.03);
    expect(s.traffic).toBe(2000);
  });

  test("simulateMarket returns three scenarios", () => {
    const state = buildOmniscientContextSync({ revenue: 100, conversion: 0.05, traffic: 1, churn: 0 });
    const sims = simulateMarket(state);
    expect(sims).toHaveLength(3);
    expect(sims.map((x) => x.type).sort()).toEqual(["FUNNEL_OPTIMIZATION", "PRICE_DOWN", "PRICE_UP"]);
  });

  test("detectMarketOpportunities filters by revenue uplift", () => {
    const state = buildOmniscientContextSync({ revenue: 100, conversion: 0.05, traffic: 1, churn: 0 });
    const opps = detectMarketOpportunities(state, simulateMarket(state));
    expect(opps.every((o) => o.expectedRevenue > state.revenue)).toBe(true);
  });

  test("rankMarketMoves orders by expectedRevenue", () => {
    const ranked = rankMarketMoves([
      { type: "PRICE_UP", expectedConversion: 0.1, expectedRevenue: 50 },
      { type: "FUNNEL_OPTIMIZATION", expectedConversion: 0.2, expectedRevenue: 200 },
    ]);
    expect(ranked[0].type).toBe("FUNNEL_OPTIMIZATION");
  });

  test("decideOmniscientActions includes top market move and expansions", () => {
    const ranked = [{ type: "FUNNEL_OPTIMIZATION" as const, expectedConversion: 0.1, expectedRevenue: 200 }];
    const actions = decideOmniscientActions(ranked, ["CREATE_NEW_MARKET_PAGES"]);
    expect(actions.some((a) => a.type === "MARKET_MOVE")).toBe(true);
    expect(actions.some((a) => a.type === "EXPANSION")).toBe(true);
  });

  test("validateOmniscientAction blocks MARKET_MOVE only", () => {
    expect(validateOmniscientAction({ type: "MARKET_MOVE" })).toBe(false);
    expect(validateOmniscientAction({ type: "EXPANSION" })).toBe(true);
  });

  test("buildOmniscientFeedForGrowthEngines emits hints", () => {
    const { hints } = buildOmniscientFeedForGrowthEngines(
      [{ type: "FUNNEL_OPTIMIZATION", expectedConversion: 0.1, expectedRevenue: 1 }],
      ["CREATE_NEW_MARKET_PAGES"],
    );
    expect(hints.some((h) => h.includes("FUNNEL"))).toBe(true);
    expect(hints.some((h) => h.includes("CREATE_NEW_MARKET_PAGES"))).toBe(true);
  });

  test("suggestExpansion thresholds", () => {
    const e1 = suggestExpansion(
      buildOmniscientContextSync({ traffic: 2000, conversion: 0.03, mrr: 0, churn: 0.02 }),
    );
    expect(e1).toContain("CREATE_NEW_MARKET_PAGES");
    const e2 = suggestExpansion(buildOmniscientContextSync({ mrr: 60000, traffic: 0, conversion: 0, churn: 0.05 }));
    expect(e2).toContain("ENTER_NEW_REGION");
  });
});
