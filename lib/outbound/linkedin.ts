import type { OutboundLead } from "@/lib/outbound/lead";
import { personalizeLead } from "@/lib/outbound/personalize";

export function generateLinkedInMessage(lead: OutboundLead): string {
  const p = personalizeLead(lead);
  const name = lead.contactName?.trim() || "der";

  return `Hei ${name},

${p.intro}

Mange vi snakker med sliter med dette:

${p.pain}

Vi har en løsning som gjør dette mye enklere.

Åpen for en kort prat?`;
}
