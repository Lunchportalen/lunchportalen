/**
 * Simple 4-feature logistic (SGD). Deterministic given weights + features.
 * Separate from {@link trainModel} linear pipeline in `./model`.
 */

export const DEFAULT_LOGISTIC_WEIGHTS = [0.1, 0.1, 0.1, 0.1] as const;

export type LogisticTrainingRow = {
  features: [number, number, number, number];
  label: number;
  revenue: number;
};

const DEFAULT_LR = 0.01;

function sigmoid(score: number): number {
  if (score > 20) return 1;
  if (score < -20) return 0;
  return 1 / (1 + Math.exp(-score));
}

/** User-facing alias: logistic score → conversion probability. */
export function predict(features: number[], weights: number[] = [...DEFAULT_LOGISTIC_WEIGHTS]): number {
  const w = weights.length >= features.length ? weights : [...DEFAULT_LOGISTIC_WEIGHTS];
  let score = 0;
  const n = Math.min(features.length, w.length);
  for (let i = 0; i < n; i++) {
    score += w[i]! * features[i]!;
  }
  return sigmoid(score);
}

/**
 * One-pass SGD (deterministic order). Returns **new** weight vector (immutable default weights).
 */
export function train(dataset: LogisticTrainingRow[], initial?: number[]): number[] {
  const weights = [...(initial ?? DEFAULT_LOGISTIC_WEIGHTS)];
  for (const row of dataset) {
    const pred = predict(row.features, weights);
    const error = row.label - pred;
    for (let i = 0; i < weights.length; i++) {
      weights[i]! += DEFAULT_LR * error * row.features[i]!;
    }
  }
  return weights;
}
