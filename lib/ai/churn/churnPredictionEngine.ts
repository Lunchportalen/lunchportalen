/**
 * AI CHURN PREDICTION ENGINE
 * Oppdager risiko for at en kunde avslutter avtalen.
 * Signaler: færre bestillinger, lavere engagement, flere avbestillinger.
 */

import { predictChurnRisk } from "@/lib/ai/engines/capabilities/churnPrediction";
import type {
  ChurnPredictionInput,
  ChurnPredictionOutput,
  ChurnEntityInput,
  ChurnRiskResult,
  ChurnSignal,
} from "@/lib/ai/engines/capabilities/churnPrediction";

export type { ChurnEntityInput, ChurnRiskResult, ChurnSignal };

/** Vurderer frafallsrisiko ut fra bestillinger, engagement og avbestillinger. */
export function getChurnRiskPredictions(
  input: ChurnPredictionInput
): ChurnPredictionOutput {
  return predictChurnRisk(input);
}

export type ChurnPredictionEngineKind = "predict";

export type ChurnPredictionEngineInput = {
  kind: "predict";
  input: ChurnPredictionInput;
};

export type ChurnPredictionEngineResult = {
  kind: "predict";
  data: ChurnPredictionOutput;
};

/**
 * Kjører churn prediction: kunder med tidlige frafallssignaler og anbefalte tiltak.
 */
export function runChurnPredictionEngine(
  req: ChurnPredictionEngineInput
): ChurnPredictionEngineResult {
  if (req.kind !== "predict") {
    throw new Error(
      `Unknown churn prediction kind: ${(req as ChurnPredictionEngineInput).kind}`
    );
  }
  return {
    kind: "predict",
    data: getChurnRiskPredictions(req.input),
  };
}
