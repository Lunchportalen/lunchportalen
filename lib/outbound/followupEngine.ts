import type { OutboundLead } from "@/lib/outbound/lead";
import { getDueFollowUps } from "@/lib/outbound/followupStore";

export type FollowUpRunItem = {
  leadId: string;
  lead: OutboundLead | undefined;
  message: string;
};

/**
 * Returnerer forfalte oppføringer med foreslått kort melding (manuell sending).
 */
export function runFollowUps(leads: OutboundLead[]): FollowUpRunItem[] {
  const due = getDueFollowUps();
  return due.map((f) => ({
    leadId: f.leadId,
    lead: leads.find((l) => l.id === f.leadId),
    message: "Hei igjen – tenkte bare å følge opp fra sist 😊",
  }));
}
