import { describe, expect, test } from "vitest";

import { buildRoadmap } from "@/lib/ai/roadmapEngine";
import { buildStrategicContext } from "@/lib/ai/strategicContext";
import { prioritizeRoadmap } from "@/lib/ai/strategicPrioritizer";
import { generateStrategicPillars } from "@/lib/ai/strategyEngine";

describe("strategic engines", () => {
  test("buildStrategicContext maps getBusinessMetrics snapshot", () => {
    const ctx = buildStrategicContext({
      revenueGrowth: 0.05,
      conversionRate: 0.03,
      churnRate: 0.01,
      eventRowsSampled: 200,
      runningExperimentsCount: 2,
    });
    expect(ctx.growthRate).toBe(0.05);
    expect(ctx.conversion).toBe(0.03);
    expect(ctx.churn).toBe(0.01);
    expect(ctx.experiments).toBe(2);
    expect(ctx.trend).toBe("up");
  });

  test("buildStrategicContext trend down when growth flat or negative", () => {
    expect(buildStrategicContext({ growthRate: 0 }).trend).toBe("down");
    expect(buildStrategicContext({ growthRate: -0.1 }).trend).toBe("down");
  });

  test("generateStrategicPillars stacks pillars deterministically", () => {
    const pillars = generateStrategicPillars({
      revenue: 0,
      growthRate: -0.01,
      conversion: 0.01,
      churn: 0.06,
      ltv: 1,
      cac: 2,
      timeHorizon: "30_days",
      experiments: 0,
      opportunities: [],
      trend: "down",
    });
    expect(pillars).toContain("RETENTION_FIRST");
    expect(pillars).toContain("CONVERSION_OPTIMIZATION");
    expect(pillars).toContain("UNIT_ECONOMICS_FIX");
    expect(pillars).toContain("ACQUISITION_PUSH");
    expect(pillars).toContain("EXPERIMENTATION_BOOTSTRAP");
  });

  test("buildRoadmap + prioritizeRoadmap orders week then action", () => {
    const raw = buildRoadmap(["CONVERSION_OPTIMIZATION", "RETENTION_FIRST", "ACQUISITION_PUSH"]);
    const sorted = prioritizeRoadmap(raw);
    expect(sorted[0].week).toBe(1);
    expect(sorted[0].action).toBe("experiment");
    expect(sorted[1].action).toBe("optimize");
    expect(sorted[sorted.length - 1].week).toBe(3);
  });

  test("pricing_review maps to manual-only step", () => {
    const r = buildRoadmap(["UNIT_ECONOMICS_FIX"]);
    expect(r).toEqual([{ week: 2, action: "pricing_review", focus: "ltv/cac" }]);
  });
});
