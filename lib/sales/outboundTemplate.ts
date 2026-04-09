import "server-only";

export type OutboundLeadLike = {
  name?: string;
  size?: number;
};

/**
 * Deterministic template for approved outbound (human review / explicit automation gates only).
 */
export function generateOutboundMessage(lead: OutboundLeadLike): string {
  const name = typeof lead.name === "string" && lead.name.trim() ? lead.name.trim() : "der";
  const size = typeof lead.size === "number" && Number.isFinite(lead.size) ? Math.max(0, Math.floor(lead.size)) : 0;
  return `Hei ${name},

Vi ser at dere har ${size}+ ansatte.

Vi kan redusere administrasjon og matsvinn betydelig.

Ønsker du en kort demo?`;
}
