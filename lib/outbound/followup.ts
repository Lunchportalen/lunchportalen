import type { OutboundLead } from "@/lib/outbound/lead";

export type FollowUpReason = "has_canteen";

/**
 * Foreslått oppfølgingstidspunkt (ms siden epoch). Kantine-path: 60 døgn.
 * Faktisk lagring klippet til minst 30 døgn i followupStore.
 */
export function scheduleFollowUp(lead: OutboundLead, reason: FollowUpReason): number | null {
  const now = Date.now();
  if (reason === "has_canteen") {
    return now + 1000 * 60 * 60 * 24 * 60;
  }
  return null;
}
