/**
 * Deterministic dampening of accumulated learning signal (anti-bias). No randomness.
 */
export function decay(score: number): number {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return n * 0.9;
}
