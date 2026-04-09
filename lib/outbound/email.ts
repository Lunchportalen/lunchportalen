import type { OutboundLead } from "@/lib/outbound/lead";
import { personalizeLead } from "@/lib/outbound/personalize";

export type ColdEmailDraft = {
  subject: string;
  body: string;
};

export function generateColdEmail(lead: OutboundLead, productUrl: string): ColdEmailDraft {
  const p = personalizeLead(lead);
  const name = lead.contactName?.trim() || "der";
  const url = String(productUrl ?? "").trim() || "#";

  return {
    subject: `Enklere lunsj for ${lead.companyName}`,
    body: `Hei ${name},

${p.intro}

${p.pain}

${p.value}

Vi jobber med bedrifter på 20–200 ansatte.

Vil du ta en rask prat?

${url}
`,
  };
}

/** mailto:-lenke etter godkjenning — ingen skjult utsending. */
export function buildMailtoHref(to: string | undefined, subject: string, body: string): string {
  const t = String(to ?? "").trim();
  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("body", body);
  const q = params.toString();
  if (!t) return `mailto:?${q}`;
  return `mailto:${t}?${q}`;
}
