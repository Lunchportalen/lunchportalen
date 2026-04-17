import { describe, expect, test } from "vitest";

import { mapMonopolyActions } from "@/lib/ai/monopoly/actionMapper";
import { buildBusinessState } from "@/lib/ai/businessStateEngine";
import { defineCategory } from "@/lib/ai/monopoly/categoryEngine";
import { evaluateThreats } from "@/lib/ai/monopoly/competitionEngine";
import { controlDemand } from "@/lib/ai/monopoly/demandEngine";
import { buildLockIn } from "@/lib/ai/monopoly/lockInEngine";
import { amplifyNetworkEffects } from "@/lib/ai/monopoly/networkEffectEngine";
import { buildMonopolyStrategy } from "@/lib/ai/monopoly/strategyEngine";
import { buildMarketContext } from "@/lib/ai/market/marketContext";

describe("monopoly engines", () => {
  test("defineCategory from market traffic", () => {
    expect(defineCategory({ marketTraffic: 500 })).toBe("CREATE_NEW_CATEGORY");
    expect(defineCategory({ marketTraffic: 2000 })).toBe("OWN_EXISTING_CATEGORY");
  });

  test("controlDemand from business state", () => {
    const s = buildBusinessState({
      revenueGrowth: 0,
      conversionRate: 0.01,
      churnRate: 0,
      eventRowsSampled: 100,
      runningExperimentsCount: 0,
    });
    expect(controlDemand(s)).toContain("INCREASE_CONTENT_OUTPUT");
    expect(controlDemand(s)).toContain("SHIFT_POSITIONING");
  });

  test("buildMonopolyStrategy stacks pillars deterministically", () => {
    const strat = buildMonopolyStrategy(
      "CREATE_NEW_CATEGORY",
      ["INCREASE_CONTENT_OUTPUT"],
      ["INCREASE_SWITCHING_COST"],
      ["CONTENT_FLYWHEEL"],
      ["HIGH_COMPETITION"],
    );
    expect(strat).toEqual([
      "CATEGORY_CREATION",
      "CONTENT_EXPANSION",
      "RETENTION_SYSTEM",
      "SEO_DOMINATION",
      "POSITIONING_REINFORCEMENT",
    ]);
  });

  test("mapMonopolyActions dedupes optimize and maps pillars", () => {
    const actions = mapMonopolyActions(["RETENTION_SYSTEM", "SEO_DOMINATION", "CONTENT_EXPANSION"]);
    expect(actions.map((a) => a.type)).toEqual(["optimize", "variant"]);
  });

  test("evaluateThreats is non-destructive labels only", () => {
    const ctx = buildMarketContext(
      { competitors: ["a", "b", "c", "d"], marketTraffic: 0, demandSignals: [], priceIndex: 1, growthRate: 0.01 },
      0,
    );
    expect(evaluateThreats(ctx)).toContain("HIGH_COMPETITION");
    expect(evaluateThreats(ctx)).toContain("LOSING_MOMENTUM");
  });
});
