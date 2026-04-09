import "server-only";

import { opsLog } from "@/lib/ops/log";

import { computeMetricNormStats } from "./normalize";
import { buildSequences } from "./sequenceBuilder";
import { loadDataset } from "./loadDataset";
import { saveSequenceModel } from "./saveSequenceModel";
import { SEQUENCE_DEFAULT_WINDOW, SEQUENCE_MIN_ROWS } from "./sequenceConstants";
import { trainSequenceModel as fitSequence } from "./lstmModel";

function trainingDisabled(): boolean {
  return String(process.env.ML_SEQUENCE_TRAINING_ENABLED ?? "").trim() === "false";
}

export type SequenceTrainPipelineResult = {
  trained: boolean;
  reason?: string;
  rowCount?: number;
  sequenceCount?: number;
  windowSize?: number;
};

export async function executeSequenceTrainingPipeline(requestId: string, windowSize = SEQUENCE_DEFAULT_WINDOW): Promise<SequenceTrainPipelineResult> {
  if (trainingDisabled()) {
    opsLog("sequence_train_skipped", { rid: requestId, reason: "ML_SEQUENCE_TRAINING_ENABLED=false" });
    return { trained: false, reason: "training_disabled" };
  }

  opsLog("sequence_train_start", { rid: requestId, windowSize });
  const data = await loadDataset();
  if (data.length < SEQUENCE_MIN_ROWS) {
    opsLog("sequence_train_skipped", { rid: requestId, reason: "insufficient_rows", rowCount: data.length });
    return { trained: false, reason: "insufficient_rows", rowCount: data.length };
  }

  const norm = computeMetricNormStats(data);
  const sequences = buildSequences(data, windowSize);
  const model = fitSequence(sequences, norm, windowSize);
  if (!model) {
    opsLog("sequence_train_skipped", { rid: requestId, reason: "fit_failed", sequenceCount: sequences.length });
    return { trained: false, reason: "fit_failed", rowCount: data.length, sequenceCount: sequences.length, windowSize };
  }

  const saved = await saveSequenceModel(model);
  opsLog("sequence_train_complete", {
    rid: requestId,
    trained: saved,
    nSequences: model.nSequences,
    windowSize: model.windowSize,
    version: model.version,
    seedLabel: model.seedLabel,
  });

  return {
    trained: saved,
    rowCount: data.length,
    sequenceCount: sequences.length,
    windowSize,
  };
}
