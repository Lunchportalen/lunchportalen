/**
 * Explainable scoring breakdown for ops logs / audit.
 */

export function explainDecision(
  action: { type?: unknown },
  base: number,
  bonus: number,
): {
  action: { type?: unknown };
  base_score: number;
  learning_bonus: number;
  final_score: number;
} {
  const b = Number.isFinite(base) ? base : 0;
  const x = Number.isFinite(bonus) ? bonus : 0;
  return {
    action,
    base_score: b,
    learning_bonus: x,
    final_score: b + x,
  };
}
