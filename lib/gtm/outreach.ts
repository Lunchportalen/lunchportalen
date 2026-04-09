/**
 * STEP 3 — Utkast til outreach: e-post, LinkedIn, oppfølging.
 * Ingen autopost — kun tekst til godkjenning (mailto / manuell lim).
 */

import type { OutboundLead } from "@/lib/outbound/lead";
import { generateColdEmail } from "@/lib/outbound/email";
import { generateLinkedInMessage } from "@/lib/outbound/linkedin";

import type { GtmLead } from "./types";

function gtmToOutbound(lead: GtmLead): OutboundLead {
  return {
    id: lead.id.replace(/^gtm_ob_/, "").replace(/^gtm_/, "gtm"),
    companyName: lead.company.name,
    industry: lead.company.industry ?? "office",
    role: lead.contact.role ?? "office",
    contactName: lead.contact.name,
    email: lead.contact.email,
    linkedinUrl: lead.contact.linkedinUrl,
    companySize: lead.company.employeeCount,
  };
}

export type GtmOutreachDrafts = {
  email: { subject: string; body: string };
  linkedin: string;
  /** Forslag til manuell oppfølging — ikke planlagt utsending */
  followUp: string;
  /** Hint til CRM / læring */
  templateKey: string;
};

/**
 * Genererer tre kanaler med samme tone som eksisterende outbound (maler + personalisering).
 */
export function buildGtmOutreachDrafts(lead: GtmLead, productUrl: string): GtmOutreachDrafts {
  const ob = gtmToOutbound(lead);
  const cold = generateColdEmail(ob, productUrl);
  const li = generateLinkedInMessage(ob);
  const name = lead.contact.name?.trim() || "du";
  const followUp = `Hei ${name},

Bare en kort oppfølging på meldingen min. Hvis timingen er feil nå — si gjerne ifra, så tar jeg kontakt senere.

Ønsker du et 10-min introspor uten forpliktelse?`;

  return {
    email: { subject: cold.subject, body: cold.body },
    linkedin: li,
    followUp,
    templateKey: "gtm_default_v1",
  };
}
