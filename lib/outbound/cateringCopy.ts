import type { OutboundLead } from "@/lib/outbound/lead";
import { products } from "@/lib/outbound/products";

/** Utkast etter pivot — ingen lunsj-abonnementspitch. */
export function generateCateringColdEmail(lead: OutboundLead): { subject: string; body: string } {
  const name = lead.contactName?.trim() || "der";
  const url = products.catering.url;
  return {
    subject: `Møtemat og catering for ${lead.companyName}`,
    body: `Hei ${name},

Takk for tilbakemeldingen — det gir mening at dere har lunsjordning som fungerer.

Mange bedrifter vi jobber med bruker ${products.catering.name} som supplement: møtemat, kaker og catering når behovet topper.

Se gjerne: ${url}

Vil du ta en kort prat bare om det som er relevant for dere?`,
  };
}

export function generateCateringLinkedInMessage(lead: OutboundLead): string {
  const name = lead.contactName?.trim() || "der";
  return `Hei ${name},

Skjønner at lunsj er dekket hos dere.

Vi hjelper ofte med møtemat, kaker og catering ved behov — via ${products.catering.name}: ${products.catering.url}

Åpen for en kort prat hvis det treffer?`;
}
