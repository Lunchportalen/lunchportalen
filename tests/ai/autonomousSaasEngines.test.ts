import { describe, expect, test } from "vitest";

import { validateAutonomousAction } from "@/lib/ai/automationEngine";
import { detectSaasOpportunities } from "@/lib/ai/autonomousOpportunityEngine";
import { generateAutonomousAction } from "@/lib/ai/autonomousGenerator";
import { prioritizeSaasActions } from "@/lib/ai/saasPriorityEngine";
import { analyzeSaas } from "@/lib/ai/saasIntelligenceEngine";
import { buildSaasState } from "@/lib/ai/saasStateEngine";

describe("autonomous SaaS engines", () => {
  test("buildSaasState maps metrics snapshot", () => {
    const s = buildSaasState({
      revenueGrowth: 0.1,
      conversionRate: 0.05,
      churnRate: 0.02,
      eventRowsSampled: 100,
      runningExperimentsCount: 0,
    });
    expect(s.traffic).toBe(100);
    expect(s.experiments).toBe(0);
    expect(s.pages).toBe(0);
  });

  test("analyzeSaas returns finite intel", () => {
    const state = buildSaasState({
      revenueGrowth: 0.2,
      conversionRate: 0.1,
      churnRate: 0.01,
      eventRowsSampled: 50,
      runningExperimentsCount: 1,
    });
    const stateWithPages = { ...state, pages: 5 };
    const i = analyzeSaas(stateWithPages);
    expect(Number.isFinite(i.activationRate)).toBe(true);
    expect(Number.isFinite(i.systemLoad)).toBe(true);
  });

  test("detectSaasOpportunities is deterministic", () => {
    const state = buildSaasState({
      revenueGrowth: 0,
      conversionRate: 0.01,
      churnRate: 0.06,
      eventRowsSampled: 100,
      runningExperimentsCount: 0,
    });
    const state2 = { ...state, pages: 3 };
    const intel = analyzeSaas({ ...state2, pages: 10 });
    const ops = detectSaasOpportunities(state2, intel);
    expect(ops).toContain("OPTIMIZE_FUNNEL");
    expect(ops).toContain("CREATE_NEW_PAGES");
    expect(ops).toContain("START_EXPERIMENT");
    expect(ops).toContain("RETENTION_ACTION");
  });

  test("generateAutonomousAction maps ops", () => {
    expect(generateAutonomousAction("CREATE_NEW_PAGES")?.type).toBe("variant");
    expect(generateAutonomousAction("START_EXPERIMENT")?.type).toBe("experiment");
    expect(generateAutonomousAction("OPTIMIZE_FUNNEL")?.type).toBe("optimize");
    expect(generateAutonomousAction("UNKNOWN")).toBeNull();
  });

  test("prioritizeSaasActions dedupes by type", () => {
    const state = buildSaasState({
      revenueGrowth: 0,
      conversionRate: 0.01,
      churnRate: 0,
      eventRowsSampled: 10,
      runningExperimentsCount: 0,
    });
    const ranked = prioritizeSaasActions(
      [
        { type: "optimize" },
        { type: "optimize" },
        { type: "experiment" },
      ],
      state,
    );
    const types = ranked.map((r) => r.type);
    expect(new Set(types).size).toBe(types.length);
    expect(ranked[0].type).toBe("experiment");
  });

  test("validateAutonomousAction blocks price types", () => {
    expect(validateAutonomousAction({ type: "experiment" })).toBe(true);
    expect(validateAutonomousAction({ type: "INCREASE_PRICE" })).toBe(false);
    expect(validateAutonomousAction({ type: "DECREASE_PRICE" })).toBe(false);
  });
});
