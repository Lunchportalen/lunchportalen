// POST /api/webhooks/tripletex — Tripletex Flow A inbound callbacks (TPT-A-6)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

import {
  buildTripletexWebhookEventId,
} from "@/lib/integrations/tripletex/tripletexWebhookEventId";
import {
  dispatchTripletexWebhookEvent,
  isSupportedTripletexWebhookEvent,
  type TripletexWebhookPayload,
} from "@/lib/integrations/tripletex/webhookHandlers";
import {
  TRIPLETEX_WEBHOOK_AUTH_HEADER,
  TRIPLETEX_WEBHOOK_HMAC_HEADER,
  verifyTripletexWebhookSignature,
} from "@/lib/integrations/tripletex/verifyTripletexWebhookSignature";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export { verifyTripletexWebhookSignature as verifyTripletexSignature };

const MAX_REQUESTS_PER_MINUTE = 120;
const rateBucket = new Map<string, { count: number; windowStart: number }>();

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const row = rateBucket.get(ip);
  if (!row || now - row.windowStart >= windowMs) {
    rateBucket.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (row.count >= MAX_REQUESTS_PER_MINUTE) return false;
  row.count += 1;
  return true;
}

function unauthorized(rid: string): Response {
  return jsonErr(rid, "Unauthorized", 401, "UNAUTHORIZED");
}

function okReceived(rid: string, duplicate = false): Response {
  return jsonOk(rid, duplicate ? { received: true, duplicate: true } : { received: true }, 200);
}

async function auditWebhook(
  action: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    const admin = supabaseAdmin();
    await admin.from("lifecycle_audit_log").insert({
      actor_id: null,
      action,
      entity_type: "tripletex_webhook",
      entity_id: String(metadata.event_id ?? metadata.rejection_id ?? "").trim() || null,
      reason: null,
      metadata,
    });
  } catch (e) {
    opsLog("tripletex_webhook_audit_failed", {
      action,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function POST(req: NextRequest) {
  const rid = makeRid("wh_tpt");

  if (!checkRateLimit(clientIp(req))) {
    opsLog("tripletex_webhook_rate_limited", { rid });
    return unauthorized(rid);
  }

  const secret = String(process.env.TRIPLETEX_WEBHOOK_SECRET ?? "").trim();
  if (!secret) {
    opsLog("tripletex_webhook_secret_missing", { rid });
    return unauthorized(rid);
  }

  const rawBody = await req.text();
  const authHeaderName = String(process.env.TRIPLETEX_WEBHOOK_AUTH_HEADER ?? TRIPLETEX_WEBHOOK_AUTH_HEADER).trim();
  const okSig = verifyTripletexWebhookSignature({
    rawBody,
    secret,
    authHeader: req.headers.get(authHeaderName),
    authorizationHeader: req.headers.get("authorization"),
    hmacHeader: req.headers.get(TRIPLETEX_WEBHOOK_HMAC_HEADER),
  });

  if (!okSig) {
    const rejectionId = `rejected:${createHash("sha256").update(rawBody).digest("hex").slice(0, 32)}`;
    await auditWebhook("tripletex_webhook_signature_rejected", {
      rid,
      rejection_id: rejectionId,
      has_body: rawBody.length > 0,
    });
    return unauthorized(rid);
  }

  let payload: TripletexWebhookPayload;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as TripletexWebhookPayload) : {};
  } catch {
    await auditWebhook("tripletex_webhook_parse_rejected", { rid });
    return okReceived(rid);
  }

  const eventId = buildTripletexWebhookEventId(payload);
  const eventType = String(payload.event ?? "").trim();

  if (!eventId || !eventType) {
    await auditWebhook("tripletex_webhook_envelope_invalid", { rid, event_type: eventType || null });
    return okReceived(rid);
  }

  const admin = supabaseAdmin();

  const { data: existing, error: existingError } = await admin
    .from("webhook_events")
    .select("id, status")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingError) {
    opsLog("tripletex_webhook_idempotency_lookup_failed", {
      rid,
      event_id: eventId,
      message: existingError.message,
    });
    return okReceived(rid);
  }

  if (existing) {
    return okReceived(rid, true);
  }

  const signatureHeader =
    req.headers.get(TRIPLETEX_WEBHOOK_HMAC_HEADER) ??
    req.headers.get(authHeaderName) ??
    null;

  const { error: insertError } = await admin.from("webhook_events").insert({
    source: "tripletex",
    event_id: eventId,
    event_type: eventType,
    payload,
    signature: signatureHeader,
    status: "PENDING",
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return okReceived(rid, true);
    }
    opsLog("tripletex_webhook_insert_failed", { rid, event_id: eventId, message: insertError.message });
    return okReceived(rid);
  }

  await auditWebhook("tripletex_webhook_received", {
    rid,
    event_id: eventId,
    event_type: eventType,
    subscription_id: payload.subscriptionId ?? null,
  });

  if (!isSupportedTripletexWebhookEvent(eventType)) {
    await admin
      .from("webhook_events")
      .update({ status: "IGNORED", processed_at: new Date().toISOString(), error_detail: null })
      .eq("event_id", eventId);
    return okReceived(rid);
  }

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
    opsLog("tripletex_webhook_dispatch_error", { rid, event_id: eventId, message: errorDetail });
  }

  await admin
    .from("webhook_events")
    .update({
      status: finalStatus,
      processed_at: new Date().toISOString(),
      error_detail: errorDetail,
    })
    .eq("event_id", eventId);

  await auditWebhook(
    finalStatus === "PROCESSED" ? "tripletex_webhook_processed" : "tripletex_webhook_failed",
    {
      rid,
      event_id: eventId,
      event_type: eventType,
      error: errorDetail,
    },
  );

  return okReceived(rid);
}
