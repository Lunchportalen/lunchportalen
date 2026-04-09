import type { RevenueEvent } from "@/lib/revenue/unified";

/** Terskel for pålitelig attributjon — under dette brukes ikke beløp til profit/skalering. */
export const ATTRIBUTION_CONFIDENCE_THRESHOLD = 0.7;

export function scoreAttribution(event: RevenueEvent): number {
  let score = 0;
  if (event.postId) score += 0.4;
  if (event.campaignId) score += 0.3;
  if (event.creativeId) score += 0.2;
  if (event.source === "ai_social") score += 0.1;
  return score;
}
