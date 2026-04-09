/**
 * Aggregerer videokonverteringssignaler for autonom motor (deterministisk snitt).
 */

import type { CalendarPost } from "@/lib/social/calendar";
import { videoConversionFunnelMetrics } from "@/lib/social/performance";

export type VideoConversionAggregate = {
  hookRetention: number;
  completionRate: number;
  sampleSize: number;
};

export function aggregateVideoConversionForAutomation(posts: CalendarPost[]): VideoConversionAggregate | null {
  const mets: Array<NonNullable<ReturnType<typeof videoConversionFunnelMetrics>>> = [];
  for (const p of posts) {
    if (p.status !== "published") continue;
    const m = videoConversionFunnelMetrics(p.performance);
    if (m) mets.push(m);
  }
  if (mets.length === 0) return null;
  const hookRetention = mets.reduce((s, m) => s + m.hookRetentionPct, 0) / mets.length;
  const completionRate = mets.reduce((s, m) => s + m.completionRatePct, 0) / mets.length;
  return { hookRetention, completionRate, sampleSize: mets.length };
}
