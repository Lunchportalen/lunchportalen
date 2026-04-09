/**
 * Slår sammen Outbound-lagring med GTM-CRM (overlay per lead-id).
 */

import type { OutboundLead } from "@/lib/outbound/lead";

import { gtmLeadFromOutbound } from "./leads";
import { withScoredLead } from "./scoring";
import type { GtmCrmSnapshot, GtmLead } from "./types";

function mergeLeadOverlay(base: GtmLead, overlay: GtmLead): GtmLead {
  return {
    ...base,
    ...overlay,
    company: { ...base.company, ...overlay.company },
    contact: { ...base.contact, ...overlay.contact },
    interactions: overlay.interactions.length > 0 ? overlay.interactions : base.interactions,
    status: overlay.status,
    score: overlay.score || base.score,
    campaignId: overlay.campaignId ?? base.campaignId,
    source: overlay.source,
    createdAt: overlay.createdAt,
    updatedAt: overlay.updatedAt,
  };
}

export function mergeGtmLeadsWithOutbound(outbound: OutboundLead[], crm: GtmCrmSnapshot): GtmLead[] {
  const map = new Map<string, GtmLead>();

  for (const ob of outbound) {
    const base = withScoredLead(gtmLeadFromOutbound(ob));
    const overlay = crm.leads.find((l) => l.id === base.id);
    map.set(base.id, overlay ? withScoredLead(mergeLeadOverlay(base, overlay)) : base);
  }

  for (const l of crm.leads) {
    if (!l.id.startsWith("gtm_ob_")) {
      map.set(l.id, withScoredLead(l));
    }
  }

  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}
