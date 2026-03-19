/**
 * Experiment analytics: getExperimentStats deterministic shape when no data.
 * Safe rendering: empty rows yield predictable structure (no undefined).
 */

import { describe, test, expect } from "vitest";
import { getExperimentStats } from "@/lib/ai/experiments/analytics";

function fakeSupabase(data: { variant: string; views: number; clicks: number; conversions: number }[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data, error: null }),
      }),
    }),
  } as any;
}

describe("experiment analytics – safe rendering", () => {
  test("getExperimentStats returns deterministic shape when no rows (empty experiment)", async () => {
    const out = await getExperimentStats(fakeSupabase([]), "exp_123");
    expect(out).toHaveProperty("views");
    expect(out).toHaveProperty("clicks");
    expect(out).toHaveProperty("conversions");
    expect(out).toHaveProperty("variants");
    expect(out).toHaveProperty("byVariant");
    expect(out.views).toBe(0);
    expect(out.clicks).toBe(0);
    expect(out.conversions).toBe(0);
    expect(Array.isArray(out.variants)).toBe(true);
    expect(out.variants.length).toBe(0);
    expect(Array.isArray(out.byVariant)).toBe(true);
    expect(out.byVariant.length).toBe(0);
  });

  test("getExperimentStats aggregates when rows exist", async () => {
    const out = await getExperimentStats(
      fakeSupabase([
        { variant: "A", views: 10, clicks: 2, conversions: 1 },
        { variant: "B", views: 8, clicks: 1, conversions: 0 },
      ]),
      "exp_123"
    );
    expect(out.views).toBe(18);
    expect(out.clicks).toBe(3);
    expect(out.conversions).toBe(1);
    expect(out.variants).toContain("A");
    expect(out.variants).toContain("B");
    expect(out.byVariant.length).toBe(2);
  });
});
