/**
 * Enkel, deterministisk lead-score (forslag — ingen automatisk prising).
 */

export type ScoredLead<T extends { status?: string | null }> = T & { score: number };

export function scorePipelineLeads<T extends { status?: string | null }>(leads: T[]): ScoredLead<T>[] {
  const list = Array.isArray(leads) ? leads : [];
  return list.map((l) => ({
    ...l,
    score: (String(l.status ?? "") === "meeting" ? 10 : 0) + (String(l.status ?? "") === "contacted" ? 5 : 0),
  }));
}
