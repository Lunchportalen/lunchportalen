import type { PredictiveRiskVerdict } from "@/lib/ai/predictiveRiskEngine";
import type { SimulatedAction } from "@/lib/ai/simulationEngine";

export type PredictiveDecisionBundle<A> = {
  best: SimulatedAction<A> | null;
  simulations: SimulatedAction<A>[];
  risk: PredictiveRiskVerdict | "NO_ACTIONS";
};

export function explainPrediction<A extends { type: string }>(decision: PredictiveDecisionBundle<A>): {
  chosen_action: string | null;
  expected_conversion: number | null;
  confidence: number | null;
  risk: string;
} {
  if (!decision.best) {
    return {
      chosen_action: null,
      expected_conversion: null,
      confidence: null,
      risk: decision.risk,
    };
  }
  return {
    chosen_action: decision.best.action.type,
    expected_conversion: decision.best.prediction.predicted_conversion,
    confidence: decision.best.prediction.confidence,
    risk: decision.risk,
  };
}
