/**
 * AI Social Engine — tidsstyring og «klar»-kø uten ekstern publisering.
 */

import type { CalendarPost } from "@/lib/social/calendar";
import { dayKeyLocal, getPlannedPostsForScheduler, promoteDuePlannedToReady } from "@/lib/social/calendar";
import type { CalendarInsights } from "@/lib/social/calendarLearning";

/** Låst av sikkerhetshensyn: ingen auto-publisering før eksplisitt driftssignal og nøkler. */
export const AUTO_PUBLISH: boolean = false;

export function getPlannedPosts(posts: CalendarPost[]): CalendarPost[] {
  return getPlannedPostsForScheduler(posts);
}

export type SchedulerRunResult = {
  posts: CalendarPost[];
  /** Antall poster som gikk fra planned → ready */
  promotedCount: number;
  /** Alltid false når {@link AUTO_PUBLISH} er false */
  wouldPublish: boolean;
};

/**
 * Marker forfalte planlagte poster som «klar». Ekstern publisering skjer ikke (safe mode).
 */
export function runScheduler(posts: CalendarPost[], now: number = Date.now()): SchedulerRunResult {
  const next = promoteDuePlannedToReady(posts, now);
  let promotedCount = 0;
  for (let i = 0; i < posts.length; i++) {
    const a = posts[i];
    const b = next[i];
    if (a && b && a.id === b.id && a.status === "planned" && b.status === "ready") promotedCount += 1;
  }
  return {
    posts: next,
    promotedCount,
    wouldPublish: AUTO_PUBLISH,
  };
}

function bucketCenterHour(bucket: string): number {
  if (bucket === "06–10") return 8;
  if (bucket === "10–14") return 12;
  if (bucket === "14–18") return 16;
  if (bucket === "18–22") return 19;
  return 12;
}

/**
 * Juster `planned` poster til foretrukket tidsvindu fra læring (lokal tid, samme slotDay).
 */
export function alignPlannedPostsToTimeInsights(
  posts: CalendarPost[],
  insights: CalendarInsights | null,
): CalendarPost[] {
  const preferred = insights?.bestTimeSlots?.[0];
  if (!preferred) return posts;
  const targetH = bucketCenterHour(preferred);

  return posts.map((p) => {
    if (p.status !== "planned") return p;
    const parts = p.slotDay.split("-").map((x) => parseInt(x, 10));
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return p;
    const d = new Date(parts[0], parts[1] - 1, parts[2], targetH, 0, 0, 0);
    return { ...p, scheduledAt: d.getTime(), slotDay: dayKeyLocal(d) };
  });
}

/**
 * Kombinerer tidsjustering fra innsikt med planned → ready (fortsatt ingen ekstern publish).
 */
export function runSchedulerWithLearning(
  posts: CalendarPost[],
  now: number,
  insights: CalendarInsights | null,
): SchedulerRunResult {
  const aligned = alignPlannedPostsToTimeInsights(posts, insights);
  return runScheduler(aligned, now);
}
