export type GtmDealLike = {
  industry?: string;
  size?: number;
  stage?: string;
};

/**
 * Eksporterer treningsvennlige rader (ingen PII) — brukes av AI/feedback-løkker.
 */
export function learnFromSales(deals: GtmDealLike[]): { industry: string | null; size: number | null; won: boolean }[] {
  const list = Array.isArray(deals) ? deals : [];
  return list.map((d) => ({
    industry: typeof d.industry === "string" ? d.industry : null,
    size: typeof d.size === "number" && Number.isFinite(d.size) ? d.size : null,
    won: String(d.stage ?? "") === "closed",
  }));
}
