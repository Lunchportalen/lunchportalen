import { describe, expect, test } from "vitest";

import { buildGlobalContext } from "@/lib/ai/globalIntelligence";
import { detectOpportunities } from "@/lib/ai/opportunityEngine";
import { generateAction } from "@/lib/ai/generativeEngine";
import { prioritize } from "@/lib/ai/prioritizationEngine";

describe("singularity engines", () => {
  test("buildGlobalContext normalizes numbers and string lists", () => {
    const ctx = buildGlobalContext({
      revenue: 1.5,
      conversion: 0.01,
      traffic: 2000,
      churn: 0,
      experiments: 0,
      topPages: ["a", "", "b"],
      worstPages: ["x"],
    });
    expect(ctx.revenue).toBe(1.5);
    expect(ctx.conversion).toBe(0.01);
    expect(ctx.traffic).toBe(2000);
    expect(ctx.topPages).toEqual(["a", "b"]);
    expect(ctx.worstPages).toEqual(["x"]);
  });

  test("detectOpportunities is deterministic for fixed context", () => {
    const ctx = buildGlobalContext({
      conversion: 0.01,
      traffic: 2000,
      experiments: 0,
      worstPages: ["/bad"],
    });
    const ops = detectOpportunities(ctx);
    expect(ops).toContain("OPTIMIZE_FUNNEL");
    expect(ops).toContain("CREATE_VARIANT");
    expect(ops).toContain("START_EXPERIMENT");
    expect(ops).toContain("FIX_LOW_PAGES");
  });

  test("generateAction maps known opportunities", () => {
    expect(generateAction("OPTIMIZE_FUNNEL")).toEqual({ type: "optimize" });
    expect(generateAction("START_EXPERIMENT")).toEqual({ type: "experiment" });
    const v = generateAction("CREATE_VARIANT");
    expect(v && v.type).toBe("variant");
    expect(v && "data" in v && v.data && typeof v.data).toBe("object");
    expect(generateAction("FIX_LOW_PAGES")).toBeNull();
  });

  test("prioritize sorts by score descending", async () => {
    const ctx = buildGlobalContext({ conversion: 0.01 });
    const ranked = await prioritize(
      [{ type: "optimize" }, { type: "experiment" }, { type: "variant", data: { version: 1, blocks: [] } }],
      ctx,
    );
    expect(ranked[0].type).toBe("experiment");
    expect(ranked.map((r) => r.type)).toEqual(["experiment", "variant", "optimize"]);
  });
});
