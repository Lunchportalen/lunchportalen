/**
 * STEP 7 — Attributjon: lead → kampanje → omsetning (deterministisk kobling).
 */

import type { GtmAttributionLink, GtmConversionEvent, GtmLead } from "./types";

function isoNow(): string {
  return new Date().toISOString();
}

/**
 * Oppdater eller opprett lenke når konvertering skjer med kjent kampanje.
 */
export function upsertAttributionFromConversion(
  links: GtmAttributionLink[],
  conv: GtmConversionEvent,
  lead: GtmLead | undefined,
): GtmAttributionLink[] {
  const campaignId = conv.campaignId ?? lead?.campaignId;
  if (!campaignId) return links;

  const idx = links.findIndex((l) => l.leadId === conv.leadId && l.campaignId === campaignId);
  const revenueAdd = typeof conv.valueNok === "number" && conv.valueNok > 0 ? conv.valueNok : 0;
  const next: GtmAttributionLink = {
    leadId: conv.leadId,
    campaignId,
    revenueNok: revenueAdd + (idx >= 0 ? links[idx]?.revenueNok ?? 0 : 0),
    lastTouchAt: isoNow(),
  };

  if (idx >= 0) {
    const copy = [...links];
    copy[idx] = next;
    return copy;
  }
  return [...links, next];
}

export function attributionSummary(links: GtmAttributionLink[]): {
  byCampaign: Record<string, { leads: number; revenueNok: number }>;
} {
  const byCampaign: Record<string, { leads: Set<string>; revenueNok: number }> = {};
  for (const l of links) {
    if (!byCampaign[l.campaignId]) {
      byCampaign[l.campaignId] = { leads: new Set(), revenueNok: 0 };
    }
    byCampaign[l.campaignId].leads.add(l.leadId);
    byCampaign[l.campaignId].revenueNok += l.revenueNok ?? 0;
  }
  const out: Record<string, { leads: number; revenueNok: number }> = {};
  for (const [k, v] of Object.entries(byCampaign)) {
    out[k] = { leads: v.leads.size, revenueNok: v.revenueNok };
  }
  return { byCampaign: out };
}
