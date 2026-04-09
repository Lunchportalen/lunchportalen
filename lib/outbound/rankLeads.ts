import type { OutboundLead } from "@/lib/outbound/lead";
import { getLeadConversation } from "@/lib/outbound/conversationStorage";
import { isHighValueLead } from "@/lib/outbound/leadValue";
import { toIndustryFromOutbound } from "@/lib/outbound/normalizeSegment";

/**
 * Rangerer leads: målbedrift 20–200, treff mot inntektssterke bransjer fra SoMe-læring, enkel forklarbar score.
 */
export function rankOutboundLeads(
  leads: OutboundLead[],
  opts?: {
    /** Første = høyest prioritet (f.eks. industriesByRevenue fra kalender-læring) */
    industriesByRevenue?: string[];
  },
): OutboundLead[] {
  const rankIdx = new Map<string, number>();
  (opts?.industriesByRevenue ?? []).forEach((k, i) => rankIdx.set(k, i));

  const score = (l: OutboundLead): number => {
    let s = 0;
    const ind = toIndustryFromOutbound(l.industry, l.companyName);
    const ri = rankIdx.get(ind);
    if (ri !== undefined) s += Math.max(0, 50 - ri * 5);

    const sz = l.companySize;
    if (sz != null && sz >= 20 && sz <= 200) s += 25;
    else if (sz != null && sz > 10 && sz < 500) s += 10;

    if (isHighValueLead(l)) s += 8;

    const conv = getLeadConversation(l.id);
    if (conv.state === "catering_pitch" || conv.pivotUsed) s += 18;

    if (l.email?.includes("@")) s += 3;
    if (l.linkedinUrl?.startsWith("http")) s += 3;
    if (l.contactName?.trim()) s += 2;

    return s;
  };

  return [...leads].sort((a, b) => score(b) - score(a));
}
