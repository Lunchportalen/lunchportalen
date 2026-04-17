import { describe, expect, test } from "vitest";

import { buildBoardReport } from "@/lib/ai/boardroom/boardOutput";
import { mergeBoardDecisions } from "@/lib/ai/boardroom/boardDecisionEngine";
import { buildBoardState } from "@/lib/ai/boardroom/boardState";
import { ceoStrategy } from "@/lib/ai/boardroom/ceoEngine";
import { cfoStrategy } from "@/lib/ai/boardroom/cfoEngine";
import { investorStrategy } from "@/lib/ai/boardroom/investorEngine";
import { simulateScenarios } from "@/lib/ai/boardroom/scenarioEngine";

describe("boardroom engines", () => {
  test("buildBoardState maps metrics snapshot", () => {
    const s = buildBoardState({
      revenueGrowth: 0.12,
      conversionRate: 0.02,
      churnRate: 0.04,
      eventRowsSampled: 100,
      revenueRowsSampled: 10,
      runningExperimentsCount: 0,
    });
    expect(s.growthRate).toBe(0.12);
    expect(s.conversion).toBe(0.02);
    expect(s.experiments).toBe(0);
  });

  test("mergeBoardDecisions dedupes in CEO → CFO → investor order", () => {
    expect(mergeBoardDecisions(["A"], ["A", "B"], ["B", "C"])).toEqual(["A", "B", "C"]);
  });

  test("simulateScenarios is deterministic", () => {
    const state = buildBoardState({
      revenue: 100,
      mrr: 0,
      growthRate: 0.1,
      conversion: 0.05,
      churn: 0.02,
      cac: 1,
      ltv: 2,
      burn: 0,
      runway: 12,
      experiments: 1,
    });
    expect(simulateScenarios(state)).toEqual({
      bestCase: { revenue: 150, growth: 0.13 },
      worstCase: { revenue: 70, churn: 0.03 },
      expected: { revenue: 110 },
    });
  });

  test("buildBoardReport includes state and advisory summary", () => {
    const state = buildBoardState({ revenue: 1, mrr: 0, growthRate: 0, conversion: 0, churn: 0, cac: 0, ltv: 0, burn: 0, runway: 12, experiments: 0 });
    const scenarios = simulateScenarios(state);
    const r = buildBoardReport(state, ["X"], scenarios, 42);
    expect(r.timestamp).toBe(42);
    expect(r.summary).toContain("recommendations only");
    expect(r.state).toEqual(state);
  });

  test("engines return stable arrays for same state", () => {
    const state = buildBoardState({
      revenueGrowth: 0.05,
      conversionRate: 0.02,
      churnRate: 0.06,
      eventRowsSampled: 1,
      revenueRowsSampled: 1,
      runningExperimentsCount: 0,
    });
    expect(ceoStrategy(state)).toEqual(["ACCELERATE_GROWTH", "OPTIMIZE_FUNNEL", "START_EXPERIMENTS"]);
    expect(cfoStrategy(state)).toContain("REDUCE_CHURN");
  });
});
