import type { MooNormalized } from "@/lib/moo/types";

const W_REV = 0.6;
const W_RET = 0.25;
const W_DWELL = 0.15;

/**
 * Single scalar score from normalized objectives (deterministic weights).
 */
export function score(n: MooNormalized): number {
  return n.revenue * W_REV + n.retention * W_RET + n.dwell * W_DWELL;
}
