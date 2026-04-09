/**
 * STEP 5 — Innvendinger: gjenbruk av lib/outbound/objections + strategisk pivot (GTM).
 */

import type { OutboundLead } from "@/lib/outbound/lead";
import { detectObjection, type OutboundObjectionId } from "@/lib/outbound/objections";
import { handleObjection } from "@/lib/outbound/responses";

import type { GtmLead } from "./types";

function gtmLeadToOutbound(lead: GtmLead): OutboundLead {
  return {
    id: lead.id,
    companyName: lead.company.name,
    industry: lead.company.industry ?? "office",
    role: lead.contact.role ?? "office",
    contactName: lead.contact.name,
    email: lead.contact.email,
    linkedinUrl: lead.contact.linkedinUrl,
    companySize: lead.company.employeeCount,
  };
}

export { detectObjection };

/**
 * Myk pivot (eksisterende outbound-kopi) når tillatt.
 */
export function gtmPivotFromOutboundResponses(
  objectionId: OutboundObjectionId,
  lead: GtmLead,
  pivotAlreadyUsed: boolean,
): string | null {
  return handleObjection(objectionId, gtmLeadToOutbound(lead), { pivotAlreadyUsed });
}

/**
 * Enterprise-linje for kantine-innvending (supplement / uten nytt kjøkken) — alternativ til myk pivot.
 */
export function gtmEnterpriseCanteenPivot(lead: GtmLead): string {
  const c = lead.company.name.trim() || "bedriften";
  return `Skjønner — «vi har kantine» er vanlig hos ${c}. Lunchportalen erstatter ikke kantinen deres, men kan ta møtemat, gjester og fleksibel bestilling uten ekstra kjøkkenkapasitet. Vil du se et 2-min oppsett som passer dere?`;
}

export function resolveGtmObjectionPivot(
  replyText: string,
  lead: GtmLead,
  opts: { pivotAlreadyUsed: boolean; preferEnterpriseLine?: boolean },
): { objectionId: OutboundObjectionId | null; message: string | null } {
  const objectionId = detectObjection(replyText);
  if (!objectionId) return { objectionId: null, message: null };

  if (opts.preferEnterpriseLine && objectionId === "has_canteen") {
    return { objectionId, message: gtmEnterpriseCanteenPivot(lead) };
  }

  const soft = gtmPivotFromOutboundResponses(objectionId, lead, opts.pivotAlreadyUsed);
  return { objectionId, message: soft };
}
