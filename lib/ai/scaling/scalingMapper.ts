import { generateVariant } from "@/lib/ai/generateVariant";
import type { SingularityGenerativeAction } from "@/lib/ai/generativeEngine";
import type { SingularityActionWithScore } from "@/lib/ai/prioritizationEngine";
import { buildMarketingHomeBody } from "@/lib/cms/seed/marketingHomeBody";

import type { ScalingPlanAction } from "./scalingDecisionEngine";

const SCALABLE_SINGULARITY = new Set(["experiment", "variant", "optimize"]);

/**
 * Maps ROI "scale" intents to safe singularity executor shapes only (no spend, no pricing).
 * "suppress" actions are advisory only → not executed here (no extra runs for losers).
 */
export function mapScalingToSystem(actions: ScalingPlanAction[]): SingularityActionWithScore[] {
  const out: SingularityActionWithScore[] = [];
  for (const a of actions) {
    if (a.type !== "scale") continue;
    const key = String(a.action ?? "").trim();
    if (!SCALABLE_SINGULARITY.has(key)) continue;

    const base: SingularityGenerativeAction =
      key === "variant"
        ? { type: "variant", data: generateVariant(buildMarketingHomeBody()) }
        : key === "optimize"
          ? { type: "optimize" }
          : { type: "experiment" };

    out.push({
      ...base,
      score: 1,
    });
  }
  return out;
}
