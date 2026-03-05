/**
 * Phase 43A: Backoff for AI job retries. Deterministic: base 30s, exponential, cap 6h.
 */

const BASE_SECONDS = 30;
const MAX_SECONDS = 6 * 60 * 60; // 6 hours

export function computeBackoffSeconds(attempt: number): number {
  if (attempt < 1) return BASE_SECONDS;
  const exp = BASE_SECONDS * Math.pow(2, attempt - 1);
  return Math.min(exp, MAX_SECONDS);
}