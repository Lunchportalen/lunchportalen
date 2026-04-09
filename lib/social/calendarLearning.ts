/**
 * Læring fra kalender-poster (ren funksjon, ingen nettverk).
 * Ikke forveksle med lib/ai/learning.ts (server-only eksperimenter).
 */

import type { CalendarPost } from "@/lib/social/calendar";

export type CalendarInsights = {
  bestProducts: string[];
  bestTimeSlots: string[];
  bestCaptions: string[];
  /** Bransje-segment (it, office, …) etter historisk score */
  bestIndustries: string[];
  /** Målroller (hr, manager, …) etter historisk score */
  bestRoles: string[];
};

const HOUR_BUCKETS = ["06–10", "10–14", "14–18", "18–22", "annet"];

function hourBucketFromMs(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  if (h >= 6 && h < 10) return "06–10";
  if (h >= 10 && h < 14) return "10–14";
  if (h >= 14 && h < 18) return "14–18";
  if (h >= 18 && h < 22) return "18–22";
  return "annet";
}

function scorePost(p: CalendarPost): number {
  const perf = p.performance;
  if (!perf) return 0;
  const rev = perf.revenue ?? 0;
  const conv = perf.conversions ?? 0;
  const clk = perf.clicks ?? 0;
  const likes = perf.likes ?? 0;
  const leads = perf.leads ?? 0;
  const demos = perf.demoBookings ?? 0;
  return rev * 100 + conv * 55 + demos * 120 + leads * 70 + clk * 3 + likes * 0.5;
}

/**
 * Analyser publiserte poster med ytelse og returner prioriterte lister.
 */
export function learnFromCalendarPosts(posts: CalendarPost[]): CalendarInsights {
  const published = posts.filter((p) => p.status === "published" && p.performance);

  const productScores = new Map<string, number>();
  const slotScores = new Map<string, number>();
  const captionScores = new Map<string, number>();
  const industryScores = new Map<string, number>();
  const roleScores = new Map<string, number>();

  for (const p of published) {
    const s = scorePost(p);
    productScores.set(p.productId, (productScores.get(p.productId) ?? 0) + s);
    const ind = p.industry ?? "office";
    industryScores.set(ind, (industryScores.get(ind) ?? 0) + s);
    const role = p.targetRole ?? "office";
    roleScores.set(role, (roleScores.get(role) ?? 0) + s);
    const bucket = hourBucketFromMs(p.scheduledAt);
    slotScores.set(bucket, (slotScores.get(bucket) ?? 0) + s);
    const cap = (p.caption ?? "").trim();
    if (cap.length > 8) {
      captionScores.set(cap, (captionScores.get(cap) ?? 0) + s);
    }
  }

  const bestProducts = [...productScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const bestTimeSlots = [...slotScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  const bestCaptions = [...captionScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c)
    .slice(0, 12);

  const bestIndustries = [...industryScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  const bestRoles = [...roleScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  return {
    bestProducts,
    bestTimeSlots: bestTimeSlots.length > 0 ? bestTimeSlots : HOUR_BUCKETS,
    bestCaptions,
    bestIndustries,
    bestRoles,
  };
}
