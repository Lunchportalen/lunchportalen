/**
 * Retargeting: klikk uten kjøp → merk målgruppe (klient-side flagg inntil annonse-API).
 */

import type { CalendarPost } from "@/lib/social/calendar";

export function syncRetargetingAudienceFlags(posts: CalendarPost[]): CalendarPost[] {
  return posts.map((p) => {
    const perf = p.performance;
    if (!perf) return { ...p, retargeting: false };
    if (perf.conversions > 0) return { ...p, retargeting: false };
    if (perf.clicks > 0) return { ...p, retargeting: true };
    return { ...p, retargeting: false };
  });
}
