/**
 * Klassifisering av poster for forsterkning — terskler på normalisert skala (0–100).
 * Enkeltvis: asymptotisk map av lineær score. I batch: min–maks-normalisering (deterministisk).
 */

import type { CalendarPost } from "@/lib/social/calendar";
import { scorePostPerformance } from "@/lib/social/scoring";

/** 0–100 fra lineær score (samme signaler som {@link scorePostPerformance}, stabil for terskel 80/20). */
export function normalizedTierScore(linearScore: number): number {
  const s = Math.max(0, linearScore);
  return Math.min(100, Math.max(0, Math.round((100 * s) / (s + 40))));
}

/**
 * Klassifisering uten batch-kontekst (UI, enkeltposter).
 */
export function classifyPost(post: CalendarPost): "winner" | "loser" | "neutral" {
  const { score: linear } = scorePostPerformance(post);
  const n = normalizedTierScore(linear);
  if (n > 80) return "winner";
  if (n < 20) return "loser";
  return "neutral";
}

/**
 * Klassifisering relativt til publisert sett (elite «topp/bunn» innen kalenderen).
 */
export function classifyPostInBatch(
  post: CalendarPost,
  minLinear: number,
  maxLinear: number,
): "winner" | "loser" | "neutral" {
  const { score: linear } = scorePostPerformance(post);
  if (maxLinear <= minLinear) return "neutral";
  const n = ((linear - minLinear) / (maxLinear - minLinear)) * 100;
  if (n > 80) return "winner";
  if (n < 20) return "loser";
  return "neutral";
}
