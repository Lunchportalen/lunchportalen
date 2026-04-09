import type { MetricRow } from "./dataset";

export type SequenceSample = {
  input: MetricRow[];
  target: MetricRow;
};

/**
 * Sliding windows over metric rows; target is the step after the window.
 */
export function buildSequences(data: MetricRow[], windowSize = 5): SequenceSample[] {
  if (windowSize < 1 || data.length <= windowSize) {
    return [];
  }
  const sequences: SequenceSample[] = [];
  for (let i = windowSize; i < data.length; i++) {
    const window = data.slice(i - windowSize, i);
    const target = data[i];
    sequences.push({ input: window, target });
  }
  return sequences;
}
