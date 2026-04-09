/**
 * Lineær omsetnings-/konverterings-score for forsterkningsmotor (deterministisk, forklarbar).
 * Tall hentes fra {@link CalendarPost.performance}.
 */

import type { CalendarPost } from "@/lib/social/calendar";

export type PostPerformanceScoreResult = {
  /** revenue×0.6 + conversionRate×0.3 + clicks×0.1 (som spesifisert). */
  score: number;
  conversionRate: number;
};

export function scorePostPerformance(post: CalendarPost): PostPerformanceScoreResult {
  const perf = post.performance;
  const revenue = perf?.revenue ?? 0;
  const conversions = perf?.conversions ?? 0;
  const clicks = (perf?.clicks ?? 0) + (perf?.imageClicks ?? 0);
  const conversionRate = clicks > 0 ? conversions / clicks : 0;
  const score = revenue * 0.6 + conversionRate * 0.3 + clicks * 0.1;
  return { score, conversionRate };
}
