import "server-only";

import { selectBestAction } from "@/lib/ai/actionSelector";
import type { GlobalIntelligenceContext } from "@/lib/ai/globalIntelligence";
import type { SingularityGenerativeAction } from "@/lib/ai/generativeEngine";
import { generateVariant } from "@/lib/ai/generateVariant";
import type { SingularityActionWithScore } from "@/lib/ai/prioritizationEngine";
import { assessPredictiveRisk, type PredictiveRiskVerdict } from "@/lib/ai/predictiveRiskEngine";
import { simulateActions, type SimulatedAction } from "@/lib/ai/simulationEngine";
import { buildMarketingHomeBody } from "@/lib/cms/seed/marketingHomeBody";

/**
 * Maps strategy tags to executable singularity-shaped actions (draft / cron / experiment only).
 */
export function decideActions(strategy: string[]): SingularityActionWithScore[] {
  return strategy
    .map((s) => {
      switch (s) {
        case "RUN_FUNNEL_EXPERIMENTS":
          return { type: "experiment" as const, score: 0 };
        case "START_EXPERIMENT":
          return { type: "experiment" as const, score: 0 };
        case "CREATE_NEW_LANDING_PAGES":
          return {
            type: "variant" as const,
            data: generateVariant(buildMarketingHomeBody()),
            score: 0,
          };
        case "IMPROVE_RETENTION":
          return { type: "optimize" as const, score: 0 };
        default:
          return null;
      }
    })
    .filter((x): x is SingularityActionWithScore => x != null);
}

export type PredictiveSingularityDecision = {
  best: SimulatedAction<NonNullable<SingularityGenerativeAction>> | null;
  simulations: SimulatedAction<NonNullable<SingularityGenerativeAction>>[];
  risk: PredictiveRiskVerdict | "NO_ACTIONS";
};

/**
 * Predict → compare → gate. Does not execute; caller runs {@link executeSingularityActions} if risk is SAFE.
 */
export async function decideWithPrediction(
  actions: Array<NonNullable<SingularityGenerativeAction>>,
  ctx: GlobalIntelligenceContext,
): Promise<PredictiveSingularityDecision> {
  if (actions.length === 0) {
    return { best: null, simulations: [], risk: "NO_ACTIONS" };
  }
  const simulations = await simulateActions(actions, ctx);
  const best = selectBestAction(simulations);
  if (!best) {
    return { best: null, simulations, risk: "NO_ACTIONS" };
  }
  const risk = assessPredictiveRisk(best.prediction);
  return { best, simulations, risk };
}
