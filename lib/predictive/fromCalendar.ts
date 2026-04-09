/**
 * Lesbar kontekst fra SoMe-kalender (performance.ts) — kun til logging / hint, ingen DB.
 */

import type { CalendarPost } from "@/lib/social/calendar";
import { aggregateRevenueByPost, totalAttributedRevenue } from "@/lib/social/performance";

export type PredictiveCalendarHint = {
  totalRecordedRevenue: number;
  topPostId: string | null;
  noteNb: string | null;
};

export function predictiveSummaryFromCalendar(posts: CalendarPost[]): PredictiveCalendarHint {
  if (!Array.isArray(posts) || posts.length === 0) {
    return {
      totalRecordedRevenue: 0,
      topPostId: null,
      noteNb: "Ingen kalenderposter — hint fra kalender tom.",
    };
  }
  const totalRecordedRevenue = totalAttributedRevenue(posts);
  const byPost = aggregateRevenueByPost(posts);
  const top = byPost[0] ?? null;
  return {
    totalRecordedRevenue,
    topPostId: top?.postId ?? null,
    noteNb: top
      ? `Kalender: sterkest registrert post ${top.postId} (${top.revenue} kr dokumentert).`
      : "Kalender: ingen poster med registrert omsetning.",
  };
}
