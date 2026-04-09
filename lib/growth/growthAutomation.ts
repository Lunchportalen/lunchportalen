/**
 * Auto-flyt: kun arketyper med dokumentert omsetning (fail-closed når tomt).
 */

import type { CalendarPost } from "@/lib/social/calendar";
import type { B2bArchetype } from "@/lib/social/b2bLeadMessaging";

/**
 * Arketyper der sum tilskrevet omsetning ≥ minTotalRevenue (kr).
 */
export function getRevenueProvenArchetypes(
  posts: CalendarPost[],
  minTotalRevenue = 1,
): B2bArchetype[] {
  const rev = new Map<string, number>();
  for (const p of posts) {
    if (p.status !== "published" || !p.b2bArchetype) continue;
    const r = p.performance?.revenue ?? 0;
    if (r <= 0) continue;
    const k = p.b2bArchetype;
    rev.set(k, (rev.get(k) ?? 0) + r);
  }
  return [...rev.entries()]
    .filter(([, v]) => v >= minTotalRevenue)
    .map(([k]) => k as B2bArchetype);
}

export function isArchetypeAllowedForAutoPublish(
  posts: CalendarPost[],
  archetype: B2bArchetype | undefined,
  minTotalRevenue = 1,
): boolean {
  if (!archetype) return false;
  const proven = getRevenueProvenArchetypes(posts, minTotalRevenue);
  if (proven.length === 0) return false;
  return proven.includes(archetype);
}
