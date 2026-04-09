import "server-only";

import type { MetricRow } from "./dataset";
import { loadSequenceModel } from "./loadSequenceModel";
import { predictNextStepConversion, type SequencePseudoRnnArtifact } from "./lstmModel";

function isSequenceArtifact(v: unknown): v is SequencePseudoRnnArtifact {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.kind === "sequence_pseudo_rnn" && typeof o.windowSize === "number" && Array.isArray(o.W_x);
}

/**
 * Predicts next-step **conversion** (denormalized) from a window of `MetricRow` (raw, not pre-normalized).
 */
export async function predictNext(sequence: MetricRow[]): Promise<number | null> {
  const raw = await loadSequenceModel();
  if (!isSequenceArtifact(raw)) {
    return null;
  }
  return predictNextStepConversion(sequence, raw);
}
