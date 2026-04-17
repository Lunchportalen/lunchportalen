import { describe, expect, it } from "vitest";

import {
  getGrowthModuleLivePosture,
  getModuleLivePostureEntry,
  isNonBroadLivePosture,
  MODULE_LIVE_POSTURE_REGISTRY,
} from "@/lib/cms/moduleLivePosture";

describe("moduleLivePosture", () => {
  it("registry har forventede kritiske id-er", () => {
    const ids = new Set(MODULE_LIVE_POSTURE_REGISTRY.map((x) => x.id));
    expect(ids.has("operational_week_menu_governance")).toBe(true);
    expect(ids.has("social_publish")).toBe(true);
    expect(ids.has("worker_jobs")).toBe(true);
  });

  it("getGrowthModuleLivePosture mapper seo/social/esg", () => {
    expect(getGrowthModuleLivePosture("seo")?.id).toBe("seo_growth");
    expect(getGrowthModuleLivePosture("social")?.posture).toBe("DRY_RUN");
    expect(getGrowthModuleLivePosture("esg")?.posture).toBe("LIMITED");
  });

  it("isNonBroadLivePosture for LIMITED", () => {
    expect(isNonBroadLivePosture("LIMITED")).toBe(true);
    expect(isNonBroadLivePosture("LIVE")).toBe(false);
  });

  it("getModuleLivePostureEntry finner worker", () => {
    expect(getModuleLivePostureEntry("worker_jobs")?.posture).toBe("STUB");
  });
});
