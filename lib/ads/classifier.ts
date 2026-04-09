/**
 * Klassifisering ut fra ROAS — ingen skjulte terskler utover disse.
 */

import { calculateROAS, type RoasInput } from "@/lib/ads/roas";

export type CampaignPerformanceClass = "winner" | "loser" | "neutral";

export function classifyCampaign(campaign: RoasInput): CampaignPerformanceClass {
  const roas = calculateROAS(campaign);
  if (roas > 3) return "winner";
  if (roas < 1) return "loser";
  return "neutral";
}
