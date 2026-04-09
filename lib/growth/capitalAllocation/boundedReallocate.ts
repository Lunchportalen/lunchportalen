import type { CapitalChannelId } from "@/lib/growth/capitalAllocation/types";
import { CAPITAL_CHANNELS } from "@/lib/growth/capitalAllocation/types";

const FLOOR = 0.1;
const MAX_ABS_DELTA = 0.2;

/** Uniform prior — exploration floor feasible. */
export function uniformWeights(): Record<CapitalChannelId, number> {
  const w = 1 / CAPITAL_CHANNELS.length;
  const o = {} as Record<CapitalChannelId, number>;
  for (const c of CAPITAL_CHANNELS) o[c] = w;
  return o;
}

function roundWeights(w: Record<CapitalChannelId, number>): Record<CapitalChannelId, number> {
  const o = {} as Record<CapitalChannelId, number>;
  for (const c of CAPITAL_CHANNELS) o[c] = Math.round(w[c]! * 1_000_000) / 1_000_000;
  return o;
}

/** Renormalize to sum 1 with per-channel floor. */
export function applyFloorAndNormalize(w: Record<CapitalChannelId, number>): Record<CapitalChannelId, number> {
  const capped = { ...w } as Record<CapitalChannelId, number>;
  for (const c of CAPITAL_CHANNELS) {
    capped[c] = Math.min(0.9, Math.max(FLOOR, capped[c] ?? FLOOR));
  }
  let sum = CAPITAL_CHANNELS.reduce((s, c) => s + capped[c]!, 0);
  if (sum <= 0) return uniformWeights();
  for (const c of CAPITAL_CHANNELS) capped[c]! /= sum;
  sum = CAPITAL_CHANNELS.reduce((s, c) => s + capped[c]!, 0);
  if (Math.abs(sum - 1) > 1e-6) {
    const k = 1 / sum;
    for (const c of CAPITAL_CHANNELS) capped[c]! *= k;
  }
  return roundWeights(capped);
}

/**
 * One bounded step: best +δ, worst −δ (δ ≤ 0.2 × stepScale), then floor + normalize.
 */
export function boundedOneStep(args: {
  before: Record<CapitalChannelId, number>;
  scores: Record<CapitalChannelId, number>;
  stepScale: number;
}): { after: Record<CapitalChannelId, number>; best: CapitalChannelId; worst: CapitalChannelId; delta: number } {
  const before = applyFloorAndNormalize(args.before);
  const ranked = [...CAPITAL_CHANNELS].sort((a, b) => {
    const d = args.scores[b]! - args.scores[a]!;
    if (d !== 0) return d;
    return a.localeCompare(b);
  });
  const best = ranked[0]!;
  const worst = ranked[ranked.length - 1]!;
  if (best === worst) {
    return { after: before, best, worst, delta: 0 };
  }

  const delta = Math.min(MAX_ABS_DELTA * args.stepScale, before[best]! - FLOOR, before[worst]! - FLOOR);
  if (delta <= 1e-9) {
    return { after: before, best, worst, delta: 0 };
  }

  const next = { ...before } as Record<CapitalChannelId, number>;
  next[best]! += delta;
  next[worst]! -= delta;

  return { after: applyFloorAndNormalize(next), best, worst, delta };
}
