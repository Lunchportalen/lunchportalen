import "server-only";

import type { TripletexWebhookPayload } from "@/lib/integrations/tripletex/webhookHandlers";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

/** Stable idempotency key from Tripletex webhook envelope. */
export function buildTripletexWebhookEventId(payload: TripletexWebhookPayload): string | null {
  const event = safeStr(payload.event);
  const id = safeStr(payload.id);
  const subscriptionId = safeStr(payload.subscriptionId);
  if (!event || !id) return null;
  return `tripletex:${subscriptionId || "0"}:${event}:${id}`;
}
