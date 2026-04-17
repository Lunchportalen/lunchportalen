import { describe, expect, test } from "vitest";

import type { AttributionRoiRow } from "@/lib/ai/attribution/roiEngine";
import { buildScalingActions } from "@/lib/ai/scaling/scalingDecisionEngine";
import { reinforceLearning } from "@/lib/ai/scaling/learningLoop";
import { detectLosers } from "@/lib/ai/scaling/loserEngine";
import { mapScalingToSystem } from "@/lib/ai/scaling/scalingMapper";
import { buildScalingState } from "@/lib/ai/scaling/scalingState";
import { detectWinners } from "@/lib/ai/scaling/winnerEngine";

describe("scaling engine", () => {
  const roi: AttributionRoiRow[] = [
    { action: "experiment", revenue: 100, cost: 50, roi: 2 },
    { action: "revenue", revenue: 0, cost: 10, roi: 0 },
    { action: "optimize", revenue: 10, cost: 20, roi: 0.5 },
  ];

  test("detectWinners and detectLosers are threshold-stable", () => {
    const w = detectWinners(roi);
    const l = detectLosers(roi);
    expect(w.map((x) => x.action)).toEqual(["experiment"]);
    expect(l.map((x) => x.action)).toContain("revenue");
    expect(l.map((x) => x.action)).toContain("optimize");
  });

  test("buildScalingState carries roi snapshot", () => {
    const state = buildScalingState({
      aggregated: {},
      roi,
      bestAction: "experiment",
    });
    expect(state.roi).toHaveLength(3);
    expect(state.timestamp).toBeGreaterThan(0);
  });

  test("buildScalingActions orders scale then suppress", () => {
    const actions = buildScalingActions(detectWinners(roi), detectLosers(roi));
    expect(actions[0]).toMatchObject({ type: "scale", action: "experiment", multiplier: 2 });
    expect(actions.some((a) => a.type === "suppress" && a.action === "revenue")).toBe(true);
  });

  test("mapScalingToSystem only maps scalable singularity keys", () => {
    const actions = buildScalingActions(detectWinners(roi), detectLosers(roi));
    const sys = mapScalingToSystem(actions);
    expect(sys.every((s) => s.type === "experiment")).toBe(true);
    expect(sys[0].score).toBe(1);
  });

  test("reinforceLearning mirrors winners", () => {
    const r = reinforceLearning(detectWinners(roi));
    expect(r).toEqual([{ reinforce: "experiment" }]);
  });
});
