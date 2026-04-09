import { scoreLead, type GtmLeadInput } from "@/lib/growth/leads";

export type ScoredLead<T extends GtmLeadInput = GtmLeadInput> = T & { score: number };

export function pickBestLeads<T extends GtmLeadInput>(leads: T[], limit = 20): ScoredLead<T>[] {
  const list = Array.isArray(leads) ? leads : [];
  return list
    .map((l) => ({ ...l, score: scoreLead(l) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
