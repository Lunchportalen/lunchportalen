import "server-only";

import {
  dispatchTripletexWebhookEvent,
  type TripletexWebhookPayload,
} from "@/lib/integrations/tripletex/webhookHandlers";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

/** Re-run Tripletex webhook handler for an existing webhook_events row (admin UI). */
export async function reprocessWebhookEventById(webhookRowId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const admin = supabaseAdmin();
  const id = safeStr(webhookRowId);
  if (!id) return { ok: false, error: "MISSING_ID" };

  const { data: row, error: readError } = await admin
    .from("webhook_events")
    .select("id, event_id, event_type, payload, status")
    .eq("id", id)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!row) return { ok: false, error: "NOT_FOUND" };

  const eventId = safeStr((row as { event_id?: unknown }).event_id);
  const eventType = safeStr((row as { event_type?: unknown }).event_type);
  const payload = ((row as { payload?: unknown }).payload ?? {}) as TripletexWebhookPayload;

  await admin
    .from("webhook_events")
    .update({ status: "PENDING", processed_at: null, error_detail: null })
    .eq("id", id);

  await admin.from("lifecycle_audit_log").insert({
    actor_id: null,
    action: "tripletex_webhook_manual_retry",
    entity_type: "tripletex_webhook",
    entity_id: eventId,
    reason: "Superadmin manual webhook reprocess",
    metadata: { webhook_row_id: id, previous_status: safeStr((row as { status?: unknown }).status) },
  });

  let finalStatus: "PROCESSED" | "FAILED" = "PROCESSED";
  let errorDetail: string | null = null;

  try {
    const result = await dispatchTripletexWebhookEvent(eventType, payload, admin, { eventId });
    if (!result.success) {
      finalStatus = "FAILED";
      errorDetail = result.error ?? "HANDLER_FAILED";
    }
  } catch (e) {
    finalStatus = "FAILED";
    errorDetail = e instanceof Error ? e.message : String(e);
  }

  await admin
    .from("webhook_events")
    .update({
      status: finalStatus,
      processed_at: new Date().toISOString(),
      error_detail: errorDetail,
    })
    .eq("id", id);

  return finalStatus === "PROCESSED" ? { ok: true } : { ok: false, error: errorDetail ?? "FAILED" };
}
