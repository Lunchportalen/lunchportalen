/**
 * Enhetlig ytelsesscore (0–100) for kanal-distribusjon og læring.
 * Prioritet: omsetning > leads > demo > klikk > likes.
 */

import type { CalendarPost } from "@/lib/social/calendar";

export function postPerformanceScore(post: {
  performance?: {
    revenue: number;
    clicks: number;
    conversions: number;
    likes?: number;
    leads?: number;
    demoBookings?: number;
    imageClicks?: number;
    imageConversions?: number;
  };
}): number {
  const perf = post.performance ?? { clicks: 0, conversions: 0, revenue: 0 };
  const r = perf.revenue ?? 0;
  const raw =
    r / 8 +
    (perf.conversions ?? 0) * 10 +
    (perf.leads ?? 0) * 12 +
    (perf.demoBookings ?? 0) * 14 +
    (perf.clicks ?? 0) * 1.2 +
    (perf.likes ?? 0) * 0.25 +
    (perf.imageClicks ?? 0) * 0.9 +
    (perf.imageConversions ?? 0) * 12;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export function calendarPostPerformanceScore(p: CalendarPost): number {
  return postPerformanceScore(p);
}
