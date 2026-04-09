import type { OutboundLead } from "@/lib/outbound/lead";

const KEY = "lp_outbound_leads_v1";

export function readOutboundLeadsFromStorage(): OutboundLead[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const v = JSON.parse(raw ?? "[]") as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x) => x && typeof (x as OutboundLead).id === "string") as OutboundLead[];
  } catch {
    return [];
  }
}

export function writeOutboundLeadsToStorage(leads: OutboundLead[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(leads.slice(0, 5000)));
  } catch {
    /* quota */
  }
}
