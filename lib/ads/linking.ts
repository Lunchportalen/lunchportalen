/**
 * Kobling kampanje ↔ omsetningshendelser (deterministisk filter).
 */

import type { RevenueEvent } from "@/lib/revenue/unified";

export function linkCampaignToRevenue(campaign: { id: string }, events: RevenueEvent[]): RevenueEvent[] {
  const cid = String(campaign?.id ?? "").trim();
  if (!cid) return [];
  return events.filter((e) => e.campaignId === cid || e.postId === cid);
}
