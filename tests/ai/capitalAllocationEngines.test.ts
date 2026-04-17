import { describe, expect, test } from "vitest";

import { allocateCapital } from "@/lib/ai/capital/allocationEngine";
import { buildCapitalReport } from "@/lib/ai/capital/capitalOutput";
import { buildCapitalState } from "@/lib/ai/capital/capitalState";
import { INVESTMENT_AREAS } from "@/lib/ai/capital/investmentAreas";
import { estimateROI } from "@/lib/ai/capital/roiEngine";
import { estimateRisk } from "@/lib/ai/capital/riskEngine";

describe("capital allocation engines", () => {
  test("buildCapitalState maps metrics snapshot", () => {
    const s = buildCapitalState({
      revenueGrowth: 0.08,
      conversionRate: 0.02,
      churnRate: 0.04,
      eventRowsSampled: 500,
      revenueRowsSampled: 1,
      runningExperimentsCount: 0,
    });
    expect(s.growth).toBe(0.08);
    expect(s.traffic).toBe(500);
    expect(s.conversion).toBe(0.02);
  });

  test("INVESTMENT_AREAS is fixed set", () => {
    expect(INVESTMENT_AREAS).toHaveLength(6);
  });

  test("estimateROI and estimateRisk are deterministic", () => {
    const state = buildCapitalState({
      revenue: 1,
      mrr: 0,
      growth: 0.05,
      conversion: 0.02,
      churn: 0.06,
      cac: 2,
      ltv: 5,
      traffic: 100,
      burn: 0,
      runway: 12,
    });
    expect(estimateROI("CONVERSION", state)).toBe(0.5);
    expect(estimateRisk("CONVERSION", state)).toBe(0.2);
  });

  test("allocateCapital sorts by score and allocation sums to ~1 when scores positive", () => {
    const state = buildCapitalState({
      revenue: 1,
      mrr: 0,
      growth: 0.05,
      conversion: 0.02,
      churn: 0.06,
      cac: 2,
      ltv: 5,
      traffic: 100,
      burn: 0,
      runway: 12,
    });
    const rows = allocateCapital(state);
    expect(rows).toHaveLength(6);
    const sum = rows.reduce((acc, r) => acc + r.allocation, 0);
    expect(sum).toBeGreaterThan(0);
    expect(sum).toBeCloseTo(1, 5);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].score).toBeGreaterThanOrEqual(rows[i].score);
    }
  });

  test("buildCapitalReport includes top priority", () => {
    const state = buildCapitalState({
      revenueGrowth: 0.15,
      conversionRate: 0.04,
      churnRate: 0.02,
      eventRowsSampled: 5000,
      revenueRowsSampled: 1,
      runningExperimentsCount: 1,
    });
    const alloc = allocateCapital(state);
    const rep = buildCapitalReport(state, alloc, 99);
    expect(rep.topPriority).toBe(alloc[0]?.area ?? null);
    expect(rep.timestamp).toBe(99);
    expect(rep.summary).toContain("ingen automatisk");
  });
});
