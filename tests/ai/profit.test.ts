import { describe, expect, test } from "vitest";

import { mapProfitActions } from "@/lib/ai/profit/profitDecisionEngine";
import { detectProfitLeaks } from "@/lib/ai/profit/profitLeakEngine";
import { detectProfitOpportunities } from "@/lib/ai/profit/profitOpportunityEngine";
import { prioritizeProfit, profitActionsToSingularity } from "@/lib/ai/profit/profitPriority";
import { buildProfitStrategy } from "@/lib/ai/profit/profitStrategyEngine";
import { buildProfitState } from "@/lib/ai/profit/profitState";

describe("profit engine", () => {
  test("buildProfitState computes margin and profit", () => {
    const s = buildProfitState({ revenue: 100, cost: 30, churn: 0.01, cac: 10, ltv: 40 });
    expect(s.profit).toBe(70);
    expect(s.margin).toBeCloseTo(0.7);
    expect(s.timestamp).toBeGreaterThan(0);
  });

  test("detectProfitLeaks and opportunities are deterministic", () => {
    const lowMargin = buildProfitState({ revenue: 100, cost: 95, churn: 0.06, cac: 50, ltv: 20 });
    expect(detectProfitLeaks(lowMargin)).toContain("LOW_MARGIN");
    expect(detectProfitLeaks(lowMargin)).toContain("HIGH_CHURN");
    const rich = buildProfitState({ revenue: 200, cost: 50, churn: 0.01, cac: 5, ltv: 40 });
    const ops = detectProfitOpportunities(rich);
    expect(ops).toContain("SCALE_WINNERS");
    expect(ops).toContain("INCREASE_ACQUISITION");
  });

  test("strategy maps to actions and priority boosts low margin", () => {
    const state = buildProfitState({ revenue: 100, cost: 90, churn: 0.01, cac: 1, ltv: 50 });
    const leaks = detectProfitLeaks(state);
    const op = detectProfitOpportunities(state);
    const strat = buildProfitStrategy(leaks, op);
    const mapped = mapProfitActions(strat);
    const pri = prioritizeProfit(mapped, state);
    expect(pri.length).toBeGreaterThan(0);
    expect(pri[0].score).toBeGreaterThanOrEqual(70);
    const sys = profitActionsToSingularity(pri.slice(0, 1));
    expect(sys[0].type).toBeDefined();
    expect(sys[0].score).toBe(pri[0].score);
  });
});
