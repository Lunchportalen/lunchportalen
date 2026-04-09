import type { LearningEntry } from "@/lib/autonomy/learning";

export type ActionWeight = {
  score: number;
  count: number;
};

export type AutonomyModel = {
  weights: Record<string, ActionWeight>;
};

/** Deterministic running average of deltaConversion per action type. */
// eslint-disable-next-line prefer-const -- spec: mutable global model
let MODEL: AutonomyModel = {
  weights: {},
};

function actionType(entry: LearningEntry): string | null {
  const a = entry.action as { type?: string } | null;
  return typeof a?.type === "string" ? a.type : null;
}

/**
 * Train from historical entries. Empty dataset → empty weights (caller falls back to rule order).
 * Deterministic; does not throw.
 */
export function trainModel(dataset: LearningEntry[]): AutonomyModel {
  const weights: Record<string, ActionWeight> = {};

  for (const entry of dataset) {
    const key = actionType(entry);
    if (!key) continue;

    if (!weights[key]) {
      weights[key] = { score: 0, count: 0 };
    }

    const delta = entry.result.deltaConversion ?? 0;
    weights[key].score += delta;
    weights[key].count += 1;
  }

  for (const key of Object.keys(weights)) {
    const w = weights[key];
    if (w.count > 0) {
      w.score /= w.count;
    }
  }

  MODEL = { weights };
  return MODEL;
}
