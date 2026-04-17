import { describe, expect, test } from "vitest";

import { runCEO } from "@/lib/ai/org/ceoAgent";
import { runGrowth } from "@/lib/ai/org/growthAgent";
import { mergeActions } from "@/lib/ai/org/orgCoordinator";
import { buildOrgContext } from "@/lib/ai/org/orgContext";
import { runOperations } from "@/lib/ai/org/operationsAgent";
import { runProduct } from "@/lib/ai/org/productAgent";

describe("autonomous org engines", () => {
  test("buildOrgContext maps metrics snapshot with fixed clock", () => {
    const t = 1_700_000_000_000;
    const ctx = buildOrgContext(
      {
        revenueGrowth: 0.1,
        conversionRate: 0.03,
        churnRate: 0.02,
        eventRowsSampled: 500,
        runningExperimentsCount: 1,
      },
      t,
    );
    expect(ctx.revenue).toBe(0.1);
    expect(ctx.conversion).toBe(0.03);
    expect(ctx.traffic).toBe(500);
    expect(ctx.experiments).toBe(1);
    expect(ctx.timestamp).toBe(t);
  });

  test("runCEO is deterministic for same context", () => {
    const ctx = buildOrgContext(
      {
        revenueGrowth: 0,
        conversionRate: 0.01,
        churnRate: 0.06,
        eventRowsSampled: 10,
        runningExperimentsCount: 0,
      },
      0,
    );
    expect(runCEO(ctx)).toEqual(["FOCUS_CONVERSION", "FOCUS_RETENTION", "START_EXPERIMENTS"]);
  });

  test("mergeActions dedupes by type first-wins", () => {
    const m = mergeActions(
      [{ type: "experiment" }, { type: "variant" }],
      [{ type: "experiment" }, { type: "optimize" }],
    );
    expect(m.map((a) => a.type)).toEqual(["experiment", "variant", "optimize"]);
  });

  test("agents compose without duplicate types in merge order growth → product → ops", () => {
    const ctx = buildOrgContext(
      {
        revenueGrowth: 0,
        conversionRate: 0.01,
        churnRate: 0.06,
        eventRowsSampled: 2000,
        runningExperimentsCount: 0,
      },
      0,
    );
    const ceo = runCEO(ctx);
    const growth = runGrowth(ctx, ceo);
    const product = runProduct(ctx);
    const ops = runOperations(ctx);
    const merged = mergeActions(growth, product, ops);
    expect(new Set(merged.map((a) => a.type)).size).toBe(merged.length);
  });
});
