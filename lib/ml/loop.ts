import "server-only";

import { buildDataset, type VariantDatasetEvent } from "@/lib/ml/dataset";
import { train } from "@/lib/ml/logisticBinary";
import { opsLog } from "@/lib/ops/log";

export type LearningLoopResult = {
  updated: boolean;
  weights: number[];
  rows: number;
};

/**
 * Offline learning step: dataset → SGD weights. Logs weights (no silent apply).
 */
export async function learningLoop(events: VariantDatasetEvent[], rid: string): Promise<LearningLoopResult> {
  const dataset = buildDataset(events);
  const newWeights = train(dataset);
  opsLog("ml.learning_loop", {
    rid,
    rows: dataset.length,
    weights: newWeights,
    model: "logistic_sgd_v1",
  });
  return {
    updated: dataset.length > 0,
    weights: newWeights,
    rows: dataset.length,
  };
}
