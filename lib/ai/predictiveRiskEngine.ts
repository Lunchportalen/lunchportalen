import type { PredictionResult } from "@/lib/ai/predictiveModel";

export type PredictiveRiskVerdict = "SAFE" | "LOW_CONFIDENCE" | "NEGATIVE_IMPACT";

/** Minimum confidence required before allowing predictive execution. */
export const PREDICTIVE_MIN_CONFIDENCE = 0.2;

export function assessPredictiveRisk(prediction: PredictionResult): PredictiveRiskVerdict {
  if (prediction.confidence < PREDICTIVE_MIN_CONFIDENCE) {
    return "LOW_CONFIDENCE";
  }
  if (prediction.predicted_conversion < 0) {
    return "NEGATIVE_IMPACT";
  }
  return "SAFE";
}
