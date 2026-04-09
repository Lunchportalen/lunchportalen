/**
 * STEP 2 — Confidence engine: minimum evidence, conversion delta, temporal consistency.
 * Pure functions — same inputs ⇒ same outputs (explainable).
 */

import "server-only";

import type { IntelligenceEvent } from "./types";

export const SCALE_MIN_EVENTS = 8;
export const SCALE_MIN_RATE_DELTA = 0.08;

function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export type ConfidenceRefinementInput = {
  /** Heuristic raw score 0–1 from pattern detector. */
  rawConfidence: number;
  /** Count of domain-relevant intelligence events (same window as pattern). */
  relevantEventCount: number;
  /** Winner rate (e.g. positive/touches) when applicable. */
  winnerRate?: number;
  /** Runner-up rate for delta rule. */
  runnerUpRate?: number | null;
  /** Recent timeline for consistency (newest-first or any order). */
  recentEvents: readonly IntelligenceEvent[];
  /** Predicate: event supports this pattern hypothesis. */
  eventSupportsWinner: (e: IntelligenceEvent) => boolean;
};

/**
 * Refine confidence: penalize thin data, weak separation from runner-up, and unstable halves of the window.
 */
export function refineScaleConfidence(input: ConfidenceRefinementInput): number {
  let c = clamp01(input.rawConfidence);
  const n = Math.max(0, Math.floor(input.relevantEventCount));

  if (n < SCALE_MIN_EVENTS) {
    c *= clamp01(n / SCALE_MIN_EVENTS);
  }

  const wr = input.winnerRate;
  const rr = input.runnerUpRate;
  if (wr != null && rr != null) {
    const delta = wr - rr;
    if (delta < SCALE_MIN_RATE_DELTA) {
      c *= clamp01(delta / SCALE_MIN_RATE_DELTA);
    }
  }

  const sorted = [...input.recentEvents].sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length >= 6) {
    const mid = sorted[Math.floor(sorted.length / 2)]!.timestamp;
    let a = 0;
    let b_ = 0;
    for (const e of sorted) {
      if (!input.eventSupportsWinner(e)) continue;
      if (e.timestamp < mid) a += 1;
      else b_ += 1;
    }
    if (a + b_ >= 4 && (a === 0 || b_ === 0)) {
      c *= 0.82;
    }
  }

  return clamp01(c);
}
