import "server-only";

import type { TripletexWebhookPayload } from "@/lib/integrations/tripletex/webhookHandlers";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

/** Provider-scoped idempotency key for Flow B webhooks. */
export function buildProviderTripletexWebhookEventId(
  providerId: string,
  env: string,
  payload: TripletexWebhookPayload,
): string | null {
  const event = safeStr(payload.event);
  const id = safeStr(payload.id);
  const subscriptionId = safeStr(payload.subscriptionId);
  const pid = safeStr(providerId);
  const e = safeStr(env) || "prod";
  if (!event || !id || !pid) return null;
  return `tripletex:provider:${pid}:${e}:${subscriptionId || "0"}:${event}:${id}`;
}
