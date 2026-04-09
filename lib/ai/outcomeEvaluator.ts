/**
 * Deterministic outcome from before/after snapshots (conversion-focused). No ML.
 */

export type OutcomeSnapshot = {
  conversion?: unknown;
};

export function evaluateOutcome(before: OutcomeSnapshot, after: OutcomeSnapshot): {
  success: boolean;
  outcome_score: number;
} {
  const b = Number(before?.conversion ?? 0);
  const a = Number(after?.conversion ?? 0);
  const bSafe = Number.isFinite(b) ? b : 0;
  const aSafe = Number.isFinite(a) ? a : 0;
  const score = aSafe - bSafe;
  return {
    success: score > 0,
    outcome_score: score,
  };
}
