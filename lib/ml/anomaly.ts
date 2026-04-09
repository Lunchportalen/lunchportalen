import "server-only";

import { opsLog } from "@/lib/ops/log";

import { predictConversion } from "./predict";

export type MLAnomalyResult = {
  anomaly: boolean;
  error: number;
  predicted: number | null;
};

export async function detectMLAnomaly(actual: number, traffic: number): Promise<MLAnomalyResult> {
  if (!Number.isFinite(actual) || !Number.isFinite(traffic)) {
    opsLog("ml_prediction", { predicted: null, actual, traffic, error: null, anomaly: false, note: "invalid_input" });
    return { anomaly: false, error: 0, predicted: null };
  }

  const predicted = await predictConversion(traffic);
  if (predicted == null || !Number.isFinite(predicted)) {
    opsLog("ml_prediction", { predicted: null, actual, traffic, error: null, anomaly: false, note: "no_model" });
    return { anomaly: false, error: 0, predicted: null };
  }

  const error = Math.abs(actual - predicted);
  const anomaly = error > 0.05;
  opsLog("ml_prediction", { predicted, actual, traffic, error, anomaly });
  return { anomaly, error, predicted };
}
