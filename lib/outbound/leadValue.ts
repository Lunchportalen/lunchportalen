import type { OutboundLead } from "@/lib/outbound/lead";

/** Målbedrift 30–200 ansatte (LTV-filter for oppfølging / prioritering). */
export function isHighValueLead(lead: OutboundLead): boolean {
  const s = lead.companySize;
  if (s == null || !Number.isFinite(s)) return false;
  return s >= 30 && s <= 200;
}
