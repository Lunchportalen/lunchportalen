import "server-only";

import type { WeightedVariant } from "@/lib/experiments/types";

/** Backoffice/CMS experiment assignment. Public demo CTA A/B uses lib/public/demoCtaAb + /api/public/ai-demo-cta/assign only. */

/** Deterministic [0,1) bucket — Edge-safe (no Node crypto). */
export function assignmentBucket(experimentId: string, userId: string): number {
  const key = `${experimentId}:${userId}`;
  let h = 2_166_136_261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16_777_619) >>> 0;
  }
  return h / 0xffff_ffff;
}

/**
 * Weighted assignment: same (experimentId, userId) always returns the same variantId.
 */
export function assignVariant(experimentId: string, userId: string, variants: WeightedVariant[]): { variantId: string } {
  const cleaned = variants
    .map((v) => ({
      variantId: String(v.variantId ?? "").trim(),
      weight: typeof v.weight === "number" && Number.isFinite(v.weight) && v.weight > 0 ? v.weight : 0,
    }))
    .filter((v) => v.variantId.length > 0);

  if (cleaned.length === 0) {
    throw new Error("NO_VARIANTS");
  }

  const total = cleaned.reduce((s, v) => s + v.weight, 0);
  const weights = total > 0 ? cleaned : cleaned.map((v) => ({ ...v, weight: 1 }));
  const sum = weights.reduce((s, v) => s + v.weight, 0);

  const r = assignmentBucket(experimentId, userId) * sum;
  let acc = 0;
  for (const v of weights) {
    acc += v.weight;
    if (r < acc) return { variantId: v.variantId };
  }
  return { variantId: weights[weights.length - 1]!.variantId };
}
