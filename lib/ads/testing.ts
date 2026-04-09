/**
 * A/B-variantvekter — topp tre etter rotasjon; 60/20/20 (utforskning på plass 2–3).
 */

import type { Creative } from "@/lib/ads/creatives";

export type CreativeVariantAssignment = {
  campaignId: string;
  creativeId: string;
  weight: number;
};

export function assignCreativeVariants(campaign: { id: string }, creatives: Creative[]): CreativeVariantAssignment[] {
  return creatives.slice(0, 3).map((c, i) => ({
    campaignId: campaign.id,
    creativeId: c.id,
    weight: i === 0 ? 0.6 : 0.2,
  }));
}
