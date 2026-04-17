import { describe, expect, test } from "vitest";

import { allocateCapital } from "@/lib/ai/capital/allocationEngine";
import { prioritizeExecution } from "@/lib/ai/capital/actionPriority";
import { buildCapitalState } from "@/lib/ai/capital/capitalState";
import { buildExecution } from "@/lib/ai/capital/executionEngine";
import { buildExecutionPlan } from "@/lib/ai/capital/executionPlan";
import { generateActions } from "@/lib/ai/capital/actionGenerator";

describe("budget execution planning", () => {
  const state = buildCapitalState({
    revenueGrowth: 0.08,
    conversionRate: 0.02,
    churnRate: 0.04,
    eventRowsSampled: 800,
    revenueRowsSampled: 1,
    runningExperimentsCount: 1,
  });

  test("buildExecutionPlan mirrors allocation weights", () => {
    const alloc = allocateCapital(state);
    const plan = buildExecutionPlan(alloc);
    expect(plan).toHaveLength(alloc.length);
    expect(plan[0].budgetPercent).toBe(alloc[0].allocation);
    expect(plan.every((p) => p.actions.length === 0)).toBe(true);
  });

  test("buildExecution + prioritize caps actions per area", () => {
    const alloc = allocateCapital(state);
    const exec = buildExecution(alloc, state);
    const pri = prioritizeExecution(exec);
    for (const p of pri) {
      expect(p.actions.length).toBeLessThanOrEqual(2);
    }
  });

  test("flat slice respects global cap of 3", () => {
    const alloc = allocateCapital(state);
    const pri = prioritizeExecution(buildExecution(alloc, state));
    const flat = pri.flatMap((p) => p.actions).slice(0, 3);
    expect(flat.length).toBeLessThanOrEqual(3);
  });

  test("generateActions is deterministic per area", () => {
    expect(generateActions("CONVERSION", state).map((a) => a.type)).toEqual(["RUN_AB_TEST", "OPTIMIZE_CTA"]);
    expect(generateActions("INFRASTRUCTURE", state)).toEqual([]);
  });
});
