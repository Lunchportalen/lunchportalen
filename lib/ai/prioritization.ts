import type { Opportunity } from "@/lib/ai/opportunities";

/**
 * Returns the highest-priority opportunities first (already sorted by detectOpportunities).
 */
export function getTopOpportunities(opportunities: Opportunity[], limit = 5): Opportunity[] {
  const n = Math.max(0, Math.floor(limit));
  return opportunities.slice(0, n);
}
