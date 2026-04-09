export type VariantScoreInput = {
  conversion: number;
  value: number;
};

/**
 * Revenue-first score (deterministic).
 */
export function scoreVariant(v: VariantScoreInput): number {
  const c = Number.isFinite(v.conversion) ? Math.max(0, v.conversion) : 0;
  const val = Number.isFinite(v.value) ? Math.max(0, v.value) : 0;
  return c * val;
}
