/**
 * Deterministic templates (no auto-send — brukes via {@link lib/gtm/sender} med logging).
 */
export type GtmMessage = {
  subject: string;
  body: string;
};

export type GtmLeadMessageInput = {
  company?: string;
  name?: string;
};

export function generateMessage(lead: GtmLeadMessageInput): GtmMessage {
  const company = typeof lead.company === "string" && lead.company.trim() ? lead.company.trim() : "bedriften deres";
  const name = typeof lead.name === "string" && lead.name.trim() ? lead.name.trim() : "der";
  return {
    subject: `Enklere lunsj for ${company}`,
    body: `Hei ${name},

Vi hjelper bedrifter med å kutte administrasjon og matsvinn rundt lunsj.

Typisk sparer våre kunder både tid og kostnader.

Har du 10 minutter denne uken?`,
  };
}
