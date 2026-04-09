import "server-only";

import type { CollectedMetrics } from "@/lib/metrics/collect";

/** Time-ordered state buffer (in-process only). */
// eslint-disable-next-line prefer-const -- spec: mutable sequence buffer
let SEQUENCE: Array<CollectedMetrics & { ts: number }> = [];

const MAX_LEN = 100;

export function pushState(state: CollectedMetrics) {
  SEQUENCE.push({
    ...state,
    ts: Date.now(),
  });

  if (SEQUENCE.length > MAX_LEN) {
    SEQUENCE.shift();
  }
}

export function getSequence(): Array<CollectedMetrics & { ts: number }> {
  return SEQUENCE;
}
