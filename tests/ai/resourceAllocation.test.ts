import { describe, expect, test } from "vitest";

import { allocateCapacity } from "@/lib/ai/resources/capacityEngine";
import { getAvailableResources } from "@/lib/ai/resources/resourceModel";
import {
  buildExecutionPlan,
  computeResourceUtilization,
} from "@/lib/ai/resources/resourceOrchestrator";

describe("resource allocation engine", () => {
  test("never allocates beyond per-resource capacity", () => {
    const resources = getAvailableResources();
    const actions = Array.from({ length: 6 }, () => ({ type: "LAUNCH_AD_CAMPAIGN" }));
    const rows = allocateCapacity(actions, resources);
    const used = new Map<string, number>();
    for (const r of rows) {
      used.set(r.resourceId, (used.get(r.resourceId) ?? 0) + r.cost);
    }
    for (const res of resources) {
      expect(used.get(res.id) ?? 0).toBeLessThanOrEqual(res.capacity);
    }
    expect(rows.length).toBe(4);
  });

  test("scheduling is deterministic for fixed nowMs", () => {
    const t0 = 1_700_000_000_000;
    const plan = buildExecutionPlan([{ type: "RUN_AB_TEST" }, { type: "OPTIMIZE_CTA" }], t0);
    expect(plan).toHaveLength(2);
    expect(plan[0].scheduledAt).toBe(new Date(t0).toISOString());
    expect(plan[1].scheduledAt).toBe(new Date(t0 + 60_000).toISOString());
  });

  test("utilization is within [0, 1]", () => {
    expect(computeResourceUtilization([])).toBe(0);
    const plan = buildExecutionPlan([{ type: "CREATE_LANDING_PAGE" }], 0);
    const u = computeResourceUtilization(plan);
    expect(u).toBeGreaterThanOrEqual(0);
    expect(u).toBeLessThanOrEqual(1);
  });
});
