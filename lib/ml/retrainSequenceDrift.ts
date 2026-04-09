import "server-only";

import { opsLog } from "@/lib/ops/log";

import { buildSequences } from "./sequenceBuilder";
import { loadDataset } from "./loadDataset";
import { loadSequenceModel } from "./loadSequenceModel";
import { predictNextStepConversion, type SequencePseudoRnnArtifact } from "./lstmModel";
import { SEQUENCE_DRIFT_WINDOW } from "./sequenceConstants";
import { detectSequenceDrift } from "./sequenceDrift";

function isSequenceArtifact(v: unknown): v is SequencePseudoRnnArtifact {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.kind === "sequence_pseudo_rnn" && typeof o.windowSize === "number";
}

/**
 * Mean absolute error on recent sequences vs current sequence model (conversion, denormalized domain).
 */
export async function computeSequenceDrift(): Promise<{ drift: boolean; errors: number[] }> {
  const errors: number[] = [];
  try {
    const model = await loadSequenceModel();
    const rows = await loadDataset();
    if (!isSequenceArtifact(model) || rows.length <= model.windowSize + 2) {
      return { drift: false, errors: [] };
    }
    const sequences = buildSequences(rows, model.windowSize);
    const slice = sequences.slice(-SEQUENCE_DRIFT_WINDOW);
    for (const s of slice) {
      const pred = predictNextStepConversion(s.input, model);
      if (pred == null || !Number.isFinite(pred)) continue;
      errors.push(Math.abs(s.target.conversion - pred));
    }
    const drift = detectSequenceDrift(errors);
    const meanErr = errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : 0;
    opsLog("sequence_drift_eval", { drift, n: errors.length, meanError: meanErr });
    return { drift, errors };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    opsLog("sequence_drift_eval_failed", { message });
    return { drift: false, errors: [] };
  }
}
