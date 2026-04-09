import "server-only";

import { opsLog } from "@/lib/ops/log";

import type { MetricRow } from "./dataset";
import { predictNext } from "./predictSequence";

export type SequenceAnomalyResult = {
  anomaly: boolean;
  error: number;
  predicted: number | null;
};

/**
 * Temporal anomaly: residual between actual conversion and sequence-model prediction (normalized space for threshold).
 */
export async function detectSequenceAnomaly(sequence: MetricRow[], actualConversion: number): Promise<SequenceAnomalyResult> {
  if (!Number.isFinite(actualConversion)) {
    opsLog("sequence_prediction", { predicted: null, actual: actualConversion, error: null, anomaly: false, note: "invalid_actual" });
    return { anomaly: false, error: 0, predicted: null };
  }

  const predicted = await predictNext(sequence);
  if (predicted == null || !Number.isFinite(predicted)) {
    opsLog("sequence_prediction", { predicted: null, actual: actualConversion, error: null, anomaly: false, note: "no_model" });
    return { anomaly: false, error: 0, predicted: null };
  }

  const error = Math.abs(actualConversion - predicted);
  const anomaly = error > 0.05;
  opsLog("sequence_prediction", { predicted, actual: actualConversion, error, anomaly });
  return { anomaly, error, predicted };
}
