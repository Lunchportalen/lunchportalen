import { describe, expect, test } from "vitest";

import { validateMarketAction } from "@/lib/ai/automationEngine";
import { analyzeCompetitors } from "@/lib/ai/market/competitorEngine";
import { decideMarketActions } from "@/lib/ai/market/marketDecisionEngine";
import { buildMarketContext } from "@/lib/ai/market/marketContext";
import { detectMarketGaps } from "@/lib/ai/market/gapEngine";
import { suggestExpansion } from "@/lib/ai/market/expansionEngine";
import { determinePosition } from "@/lib/ai/market/positioningEngine";
import { simulatePricing } from "@/lib/ai/market/pricingStrategyEngine";

describe("market domination engines", () => {
  test("buildMarketContext normalizes input", () => {
    const t = 1_710_000_000_000;
    const ctx = buildMarketContext(
      {
        competitors: ["a", "b"],
        marketTraffic: 12000,
        demandSignals: [],
        priceIndex: 1.3,
        growthRate: 0.2,
      },
      t,
    );
    expect(ctx.competitors).toEqual(["a", "b"]);
    expect(ctx.marketTraffic).toBe(12000);
    expect(ctx.priceIndex).toBe(1.3);
    expect(ctx.timestamp).toBe(t);
  });

  test("analyzeCompetitors and determinePosition", () => {
    const ctx = buildMarketContext({ competitors: [], priceIndex: 1.3, marketTraffic: 0, demandSignals: [], growthRate: 0 }, 0);
    const ins = analyzeCompetitors(ctx);
    expect(ins).toContain("NO_COMPETITOR_DATA");
    expect(ins).toContain("OVERPRICED_MARKET");
    expect(determinePosition(ctx, ins)).toBe("VALUE_LEADER");
  });

  test("detectMarketGaps and expansion pipeline", () => {
    const ctx = buildMarketContext(
      { competitors: ["x"], marketTraffic: 20000, demandSignals: [], priceIndex: 1, growthRate: 0.15 },
      0,
    );
    const gaps = detectMarketGaps(ctx);
    expect(gaps).toContain("UNSERVED_DEMAND");
    expect(gaps).toContain("EXPANDING_MARKET");
    const exp = suggestExpansion(ctx, gaps);
    expect(exp).toEqual(["CREATE_LANDING_PAGES", "INCREASE_ACQUISITION"]);
    expect(decideMarketActions(exp).map((a) => a.type)).toEqual(["variant", "experiment"]);
  });

  test("simulatePricing is suggest-only deltas", () => {
    const hi = simulatePricing({ position: "BALANCED_POSITION" }, { priceIndex: 1.25 });
    expect(hi).toEqual([{ type: "DECREASE_PRICE", delta: 5 }]);
    const lo = simulatePricing({ position: "BALANCED_POSITION" }, { priceIndex: 0.75 });
    expect(lo).toEqual([{ type: "INCREASE_PRICE", delta: 5 }]);
  });

  test("validateMarketAction blocks pricing types", () => {
    expect(validateMarketAction({ type: "variant" })).toBe(true);
    expect(validateMarketAction({ type: "INCREASE_PRICE", delta: 5 })).toBe(false);
    expect(validateMarketAction({ type: "DECREASE_PRICE", delta: 5 })).toBe(false);
  });
});
