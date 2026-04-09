import "server-only";

import { opsLog } from "@/lib/ops/log";

import { buildFeatures } from "./features";
import { loadDataset } from "./loadDataset";
import { saveModel } from "./saveModel";
import { trainModel } from "./model";

export type TrainPipelineResult = {
  trained: boolean;
  reason?: string;
  rowCount?: number;
  featureCount?: number;
  modelN?: number;
};

function trainingDisabled(): boolean {
  return String(process.env.ML_CRON_TRAINING_ENABLED ?? "").trim() === "false";
}

/**
 * Full offline-capable training path (DB + deterministic OLS). No external APIs.
 */
export async function executeModelTrainingPipeline(requestId: string): Promise<TrainPipelineResult> {
  if (trainingDisabled()) {
    opsLog("ml_train_skipped", { rid: requestId, reason: "ML_CRON_TRAINING_ENABLED=false" });
    return { trained: false, reason: "training_disabled" };
  }

  opsLog("ml_train_start", { rid: requestId });
  const dataset = await loadDataset();
  if (dataset.length < 8) {
    opsLog("ml_train_skipped", { rid: requestId, reason: "insufficient_rows", rowCount: dataset.length });
    return { trained: false, reason: "insufficient_rows", rowCount: dataset.length };
  }

  const features = buildFeatures(dataset);
  const model = trainModel(features);
  if (!model) {
    opsLog("ml_train_skipped", { rid: requestId, reason: "fit_failed", featureCount: features.length });
    return { trained: false, reason: "fit_failed", featureCount: features.length };
  }

  const saved = await saveModel(model);
  opsLog("ml_train_complete", {
    rid: requestId,
    trained: saved,
    modelN: model.n,
    r2: model.r2,
    version: model.version,
    seedLabel: model.seedLabel,
  });

  return {
    trained: saved,
    rowCount: dataset.length,
    featureCount: features.length,
    modelN: model.n,
  };
}
