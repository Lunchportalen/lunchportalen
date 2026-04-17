import { describe, expect, it } from "vitest";

import { CONTROL_PLANE_RUNTIME_MODULES } from "@/lib/cms/controlPlaneRuntimeStatusData";

describe("controlPlaneRuntimeStatusData", () => {
  it("har unike id-er", () => {
    const ids = CONTROL_PLANE_RUNTIME_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("merker social som DRY_RUN og worker som STUB (ærlig plattformstatus)", () => {
    expect(CONTROL_PLANE_RUNTIME_MODULES.find((m) => m.id === "social")?.badge).toBe("DRY_RUN");
    expect(CONTROL_PLANE_RUNTIME_MODULES.find((m) => m.id === "worker")?.badge).toBe("STUB");
  });

  it("skiller ansatt uke (LIVE) og redaksjonell ukeplan (LIMITED)", () => {
    expect(CONTROL_PLANE_RUNTIME_MODULES.find((m) => m.id === "week")?.badge).toBe("LIVE");
    expect(CONTROL_PLANE_RUNTIME_MODULES.find((m) => m.id === "weekplan_editorial")?.badge).toBe("LIMITED");
  });
});
