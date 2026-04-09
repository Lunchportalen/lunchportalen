/**
 * Dagsgrenser — ingen spam, ingen duplikater samme dag for samme innhold.
 */

import { appendOutboundSent, countSentToday, wasSentToday, type OutboundSentRecord } from "@/lib/outbound/sentLog";

export const OUTBOUND_MAX_EMAIL_PER_DAY = 20;
export const OUTBOUND_MAX_LINKEDIN_PER_DAY = 10;

export type QuotaCheck = { ok: true } | { ok: false; reason: string };

export function checkOutboundQuota(channel: "email" | "linkedin"): QuotaCheck {
  if (typeof window === "undefined") return { ok: false, reason: "Kun i nettleser." };
  const n = countSentToday(channel);
  const max = channel === "email" ? OUTBOUND_MAX_EMAIL_PER_DAY : OUTBOUND_MAX_LINKEDIN_PER_DAY;
  if (n >= max) return { ok: false, reason: `Dagsgrense nådd (${max} ${channel === "email" ? "e-poster" : "LinkedIn-forslag"}).` };
  return { ok: true };
}

export function checkOutboundDedupe(leadId: string, channel: "email" | "linkedin", bodyHash: string): QuotaCheck {
  if (wasSentToday(leadId, channel, bodyHash)) {
    return { ok: false, reason: "Samme melding er allerede loggført i dag for denne kontakten." };
  }
  return { ok: true };
}

/** Etter manuell utsending / kopiering — kall kun når bruker bekrefter. */
export function recordOutboundApprovedSend(
  leadId: string,
  channel: "email" | "linkedin",
  bodyHash: string,
): QuotaCheck {
  const q = checkOutboundQuota(channel);
  if (!q.ok) return q;
  const d = checkOutboundDedupe(leadId, channel, bodyHash);
  if (!d.ok) return d;
  const rec: OutboundSentRecord = { leadId, channel, bodyHash, at: Date.now() };
  appendOutboundSent(rec);
  return { ok: true };
}
