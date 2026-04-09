/**
 * Forsiktig skalering (+15 % maks per steg) — kun når ROAS er over terskel.
 */

import { guardrails } from "@/lib/ads/guardrails";
import { calculateROAS, type RoasInput } from "@/lib/ads/roas";

export type ScaleCampaignInput = RoasInput & { budget: number };

export function scaleCampaign(campaign: ScaleCampaignInput): number {
  const roas = calculateROAS(campaign);
  if (roas < guardrails.minROAS) return campaign.budget;
  const increase = campaign.budget * 0.15;
  return campaign.budget + increase;
}
