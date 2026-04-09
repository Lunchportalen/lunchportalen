import "server-only";

import type { CollectedMetrics } from "@/lib/metrics/collect";

export type OutcomeRecord = {
  deltaOrders: number;
  deltaConversion: number;
};

export type LearningEntry = {
  action: unknown;
  result: OutcomeRecord;
  context: CollectedMetrics;
  ts: number;
};

/** Time-series snapshots (metrics + ts) — bounded, in-memory only. */
// eslint-disable-next-line prefer-const -- spec: mutable series buffer
let SERIES: Array<CollectedMetrics & { ts: number }> = [];

/** Outcome history for weighted learning (trainModel); separate from SERIES. */
const OUTCOME_BUFFER: LearningEntry[] = [];

const MAX_SERIES = 500;
const MAX_OUTCOMES = 500;
const DATASET_WINDOW = 200;

export function storeSnapshot(metrics: CollectedMetrics) {
  SERIES.push({
    ...metrics,
    ts: Date.now(),
  });

  if (SERIES.length > MAX_SERIES) {
    SERIES.shift();
  }
}

export function getSeries(): Array<CollectedMetrics & { ts: number }> {
  return SERIES;
}

export function storeOutcome(action: unknown, result: OutcomeRecord, context: CollectedMetrics) {
  OUTCOME_BUFFER.push({
    action,
    result,
    context,
    ts: Date.now(),
  });

  while (OUTCOME_BUFFER.length > MAX_OUTCOMES) {
    OUTCOME_BUFFER.shift();
  }
}

export function getDataset(): LearningEntry[] {
  return OUTCOME_BUFFER.slice(-DATASET_WINDOW);
}
