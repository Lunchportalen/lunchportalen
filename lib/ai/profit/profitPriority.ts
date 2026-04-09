import { generateVariant } from "@/lib/ai/generateVariant";
import type { SingularityActionWithScore } from "@/lib/ai/prioritizationEngine";
import { buildMarketingHomeBody } from "@/lib/cms/seed/marketingHomeBody";

import type { ProfitMappedAction } from "./profitDecisionEngine";
import type { ProfitState } from "./profitState";

export type ProfitPrioritizedAction = ProfitMappedAction & { score: number };

export function prioritizeProfit(actions: ProfitMappedAction[], state: ProfitState): ProfitPrioritizedAction[] {
  return actions
    .map((a) => {
      let score = 0;
      if (a.type === "optimize") score += 20;
      if (a.type === "variant") score += 30;
      if (a.type === "experiment") score += 40;
      if (state.margin < 0.2) score += 50;
      return { ...a, score };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Safe singularity shapes for {@link executeSingularityActions} (draft / cron / experiment only — no payments).
 */
export function profitActionsToSingularity(actions: ProfitPrioritizedAction[]): SingularityActionWithScore[] {
  return actions.map((a) => {
    if (a.type === "variant") {
      return {
        type: "variant",
        data: generateVariant(buildMarketingHomeBody()),
        score: a.score,
      };
    }
    if (a.type === "optimize") {
      return { type: "optimize", score: a.score };
    }
    return { type: "experiment", score: a.score };
  });
}
