// POST /api/webhooks/tripletex-provider/[providerId] — Flow B paid-status sync (TPT-B-6)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

import {
  dispatchProviderTripletexWebhookEvent,
  isProviderPaidStatusWebhookEvent,
} from "@/lib/integrations/tripletex/agreementWebhookHandlers";
import { buildProviderTripletexWebhookEventId } from "@/lib/integrations/tripletex/providerTripletexWebhookEventId";
import type { TripletexWebhookPayload } from "@/lib/integrations/tripletex/webhookHandlers";
import {
  TRIPLETEX_WEBHOOK_AUTH_HEADER,
  TRIPLETEX_WEBHOOK_HMAC_HEADER,
  verifyTripletexWebhookSignature,
} from "@/lib/integrations/tripletex/verifyTripletexWebhookSignature";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: { providerId: string } | Promise<{ providerId: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function parseEnv(v: string | null): "test" | "prod" {
  const e = safeStr(v).toLowerCase();
  return e === "test" ? "test" : "prod";
}

function unauthorized(rid: string): Response {
  return jsonErr(rid, "Unauthorized", 401, "UNAUTHORIZED");
}

function okReceived(rid: string, data: Record<string, unknown> = {}): Response {
  return jsonOk(rid, { received: true, ...data }, 200);
}

async function auditWebhook(action: string, metadata: Record<string, unknown>): Promise<void> {
  try {
    const admin = supabaseAdmin();
    await admin.from("lifecycle_audit_log").insert({
      actor_id: null,
      action,
      entity_type: "tripletex_provider_webhook",
      entity_id: safeStr(metadata.event_id) || safeStr(metadata.provider_id) || null,
      reason: null,
      metadata,
    });
  } catch (e) {
    opsLog("tripletex_provider_webhook_audit_failed", {
      action,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

async function loadProviderWebhookSecret(
  providerId: string,
  env: "test" | "prod",
): Promise<string | null> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("lp_provider_load_webhook_secret", {
    p_provider_id: providerId,
    p_env: env,
  });
  if (error) {
    opsLog("tripletex_provider_webhook_secret_load_failed", {
      provider_id: providerId,
      env,
      message: error.message,
    });
    return null;
  }
  return safeStr((data as Record<string, unknown>)?.webhook_secret) || null;
}

async function providerExists(providerId: string): Promise<boolean> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("providers")
    .select("id")
    .eq("id", providerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const rid = makeRid("wh_tpt_prov");
  const params = await Promise.resolve(ctx.params);
  const providerId = safeStr(params.providerId);
  const url = new URL(req.url);
  const env = parseEnv(url.searchParams.get("env"));

  if (!UUID_RE.test(providerId)) {
    return unauthorized(rid);
  }

  if (!(await providerExists(providerId))) {
    await auditWebhook("tripletex_provider_webhook_unknown_provider", {
      rid,
      provider_id: providerId,
    });
    return unauthorized(rid);
  }

  const secret = await loadProviderWebhookSecret(providerId, env);
  if (!secret) {
    await auditWebhook("tripletex_provider_webhook_secret_missing", {
      rid,
      provider_id: providerId,
      env,
    });
    return unauthorized(rid);
  }

  const rawBody = await req.text();
  const okSig = verifyTripletexWebhookSignature({
    rawBody,
    secret,
    authHeader: req.headers.get(TRIPLETEX_WEBHOOK_AUTH_HEADER),
    authorizationHeader: req.headers.get("authorization"),
    hmacHeader: req.headers.get(TRIPLETEX_WEBHOOK_HMAC_HEADER),
  });

  if (!okSig) {
    const rejectionId = `rejected:${createHash("sha256").update(rawBody).digest("hex").slice(0, 32)}`;
    await auditWebhook("tripletex_provider_webhook_signature_rejected", {
      rid,
      provider_id: providerId,
      env,
      rejection_id: rejectionId,
      has_body: rawBody.length > 0,
    });
    return unauthorized(rid);
  }

  let payload: TripletexWebhookPayload;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as TripletexWebhookPayload) : {};
  } catch {
    await auditWebhook("tripletex_provider_webhook_parse_rejected", { rid, provider_id: providerId });
    return okReceived(rid, { ignored: true, reason: "PARSE_ERROR" });
  }

  const eventId = buildProviderTripletexWebhookEventId(providerId, env, payload);
  const eventType = safeStr(payload.event);

  if (!eventId || !eventType) {
    await auditWebhook("tripletex_provider_webhook_envelope_invalid", {
      rid,
      provider_id: providerId,
      event_type: eventType || null,
    });
    return okReceived(rid, { ignored: true, reason: "INVALID_ENVELOPE" });
  }

  const admin = supabaseAdmin();

  const { data: existing, error: existingError } = await admin
    .from("tripletex_webhook_events")
    .select("id, status")
    .eq("provider_id", providerId)
    .eq("env", env)
    .eq("tripletex_event_id", eventId)
    .maybeSingle();

  if (existingError) {
    opsLog("tripletex_provider_webhook_idempotency_lookup_failed", {
      rid,
      event_id: eventId,
      message: existingError.message,
    });
    return okReceived(rid, { pending: true, reason: "IDEMPOTENCY_LOOKUP_FAILED" });
  }

  if (existing) {
    return okReceived(rid, { duplicate: true });
  }

  const { error: insertError } = await admin.from("tripletex_webhook_events").insert({
    provider_id: providerId,
    env,
    tripletex_event_id: eventId,
    event_type: eventType,
    payload,
    status: "PENDING",
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return okReceived(rid, { duplicate: true });
    }
    opsLog("tripletex_provider_webhook_insert_failed", {
      rid,
      event_id: eventId,
      message: insertError.message,
    });
    return okReceived(rid, { pending: true, reason: "INSERT_FAILED" });
  }

  await auditWebhook("tripletex_provider_webhook_received", {
    rid,
    provider_id: providerId,
    env,
    event_id: eventId,
    event_type: eventType,
    subscription_id: payload.subscriptionId ?? null,
  });

  if (!isProviderPaidStatusWebhookEvent(eventType)) {
    await admin
      .from("tripletex_webhook_events")
      .update({
        status: "IGNORED",
        processed_at: new Date().toISOString(),
        error_detail: null,
      })
      .eq("provider_id", providerId)
      .eq("env", env)
      .eq("tripletex_event_id", eventId);
    return okReceived(rid, { ignored: true, event_type: eventType });
  }

  let finalStatus: "PROCESSED" | "IGNORED" | "FAILED" | "PENDING" = "PROCESSED";
  let errorDetail: string | null = null;
  let responseExtra: Record<string, unknown> = {};

  try {
    const result = await dispatchProviderTripletexWebhookEvent(eventType, payload, admin, {
      providerId,
      env,
      eventId,
    });

    if (result.pending) {
      finalStatus = "PENDING";
      errorDetail = result.error ?? "REVERIFY_PENDING";
      responseExtra = { pending: true, reason: errorDetail };
    } else if (!result.success) {
      finalStatus = "FAILED";
      errorDetail = result.error ?? "HANDLER_FAILED";
    } else if (result.noop) {
      finalStatus = "IGNORED";
      responseExtra = { noop: true, ...(result.detail ?? {}) };
    } else {
      responseExtra = { ...(result.detail ?? {}) };
    }
  } catch (e) {
    finalStatus = "FAILED";
    errorDetail = e instanceof Error ? e.message : String(e);
    opsLog("tripletex_provider_webhook_dispatch_error", {
      rid,
      event_id: eventId,
      message: errorDetail,
    });
  }

  if (finalStatus !== "PENDING") {
    await admin
      .from("tripletex_webhook_events")
      .update({
        status: finalStatus,
        processed_at: new Date().toISOString(),
        error_detail: errorDetail,
      })
      .eq("provider_id", providerId)
      .eq("env", env)
      .eq("tripletex_event_id", eventId);
  }

  await auditWebhook(
    finalStatus === "PROCESSED"
      ? "tripletex_provider_webhook_processed"
      : finalStatus === "PENDING"
        ? "tripletex_provider_webhook_pending"
        : finalStatus === "IGNORED"
          ? "tripletex_provider_webhook_ignored"
          : "tripletex_provider_webhook_failed",
    {
      rid,
      provider_id: providerId,
      env,
      event_id: eventId,
      event_type: eventType,
      status: finalStatus,
      error: errorDetail,
    },
  );

  return okReceived(rid, responseExtra);
}
