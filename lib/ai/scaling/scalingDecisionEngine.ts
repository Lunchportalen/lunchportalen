import type { AttributionRoiRow } from "@/lib/ai/attribution/roiEngine";

export type ScalingPlanAction =
  | { type: "scale"; action: string; multiplier: number }
  | { type: "suppress"; action: string };

const SCALE_MULTIPLIER = 2;

export function buildScalingActions(winners: AttributionRoiRow[], losers: AttributionRoiRow[]): ScalingPlanAction[] {
  const actions: ScalingPlanAction[] = [];
  for (const w of winners) {
    const key = String(w.action ?? "").trim();
    if (!key) continue;
    actions.push({
      type: "scale",
      action: key,
      multiplier: SCALE_MULTIPLIER,
    });
  }
  for (const l of losers) {
    const key = String(l.action ?? "").trim();
    if (!key) continue;
    actions.push({
      type: "suppress",
      action: key,
    });
  }
  return actions;
}
