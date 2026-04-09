/**
 * Statisk møte-tekst (ingen LLM) — møteforespørsel med plassholder for booking-lenke.
 */
export function generateMeetingMessage(lead: {
  company_name?: string | null;
  meta?: Record<string, unknown> | null;
}): string {
  let company = "deres";
  if (typeof lead.company_name === "string" && lead.company_name.trim()) {
    company = lead.company_name.trim();
  } else if (lead.meta && typeof lead.meta === "object" && !Array.isArray(lead.meta)) {
    const cn = (lead.meta as Record<string, unknown>).company_name;
    if (typeof cn === "string" && cn.trim()) company = cn.trim();
  }

  return `Hei!

Ser det kan være aktuelt å ta dette videre.

Skal vi ta en kort prat (10–15 min) og se på hvordan dette kan fungere for ${company}?

Her er et forslag til tidspunkt:
[BOOKING LINK]

Mvh`;
}
