import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getTripletexInvoicePaymentStatus,
  resolveTripletexAuth,
  TripletexClientError,
} from "@/lib/integrations/tripletex/client";
import type { TripletexWebhookPayload } from "@/lib/integrations/tripletex/webhookHandlers";

export type AgreementWebhookHandlerResult = {
  success: boolean;
  noop?: boolean;
  pending?: boolean;
  error?: string;
  detail?: Record<string, unknown>;
};

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function tripletexObjectId(payload: TripletexWebhookPayload): string {
  return safeStr(payload.id);
}

function extractInvoiceIdsFromCloseGroup(value: Record<string, unknown> | null | undefined): string[] {
  if (!value || typeof value !== "object") return [];
  const postings = (value as { postings?: unknown }).postings;
  if (!Array.isArray(postings)) return [];
  const ids = new Set<string>();
  for (const row of postings) {
    if (!row || typeof row !== "object") continue;
    const invoice = (row as { invoice?: unknown; invoiceId?: unknown }).invoice;
    const direct = (row as { invoiceId?: unknown }).invoiceId;
    if (invoice && typeof invoice === "object") {
      const id = safeStr((invoice as { id?: unknown }).id);
      if (id) ids.add(id);
    }
    const flat = safeStr(direct);
    if (flat) ids.add(flat);
  }
  return [...ids];
}

async function writeAgreementWebhookAudit(
  admin: SupabaseClient,
  action: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await admin.from("lifecycle_audit_log").insert({
    actor_id: null,
    action,
    entity_type: "tripletex_provider_webhook",
    entity_id: safeStr(metadata.invoice_id) || safeStr(metadata.event_id) || null,
    reason: null,
    metadata,
  });
}

async function applyPaidIfVerified(input: {
  admin: SupabaseClient;
  providerId: string;
  env: "test" | "prod";
  tripletexInvoiceId: string;
  eventId: string;
  eventType: string;
}): Promise<AgreementWebhookHandlerResult> {
  const { admin, providerId, env, tripletexInvoiceId, eventId, eventType } = input;

  let auth;
  try {
    auth = await resolveTripletexAuth({ providerId, env });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: "CREDENTIALS_UNAVAILABLE", detail: { message: msg } };
  }

  try {
    const payment = await getTripletexInvoicePaymentStatus(tripletexInvoiceId, { auth });
    if (!payment.isPaid) {
      await writeAgreementWebhookAudit(admin, "tripletex_provider_webhook_unverified_unpaid", {
        event_id: eventId,
        event_type: eventType,
        provider_id: providerId,
        tripletex_invoice_id: tripletexInvoiceId,
        amount_outstanding: payment.amountOutstanding,
      });
      return { success: true, noop: true, detail: { reason: "REVERIFY_NOT_PAID" } };
    }
  } catch (e) {
    const isTransient =
      e instanceof TripletexClientError &&
      (e.kind === "TRANSIENT" || (e.status != null && e.status >= 500));
    if (isTransient) {
      return {
        success: false,
        pending: true,
        error: "REVERIFY_TRANSIENT",
        detail: { message: e instanceof Error ? e.message : String(e) },
      };
    }
    await writeAgreementWebhookAudit(admin, "tripletex_provider_webhook_reverify_failed", {
      event_id: eventId,
      event_type: eventType,
      provider_id: providerId,
      tripletex_invoice_id: tripletexInvoiceId,
      message: e instanceof Error ? e.message : String(e),
    });
    return { success: true, noop: true, detail: { reason: "REVERIFY_FAILED" } };
  }

  const { data, error } = await admin.rpc("lp_apply_tripletex_paid_status", {
    p_provider_id: providerId,
    p_tripletex_invoice_id: tripletexInvoiceId,
  });

  if (error) {
    return {
      success: false,
      error: safeStr(error.message) || "APPLY_PAID_RPC_FAILED",
    };
  }

  const result = (data ?? {}) as Record<string, unknown>;
  const updated = Boolean(result.updated);
  const reason = safeStr(result.reason);

  if (reason === "NOT_FOUND") {
    return { success: true, noop: true, detail: { reason: "UNKNOWN_INVOICE" } };
  }

  if (reason === "ALREADY_PAID" || (!updated && reason === "INVALID_TRANSITION")) {
    await writeAgreementWebhookAudit(admin, "tripletex_provider_webhook_paid_noop", {
      event_id: eventId,
      event_type: eventType,
      provider_id: providerId,
      tripletex_invoice_id: tripletexInvoiceId,
      previous_status: result.previous_status ?? null,
      reason,
      invoice_id: result.invoice_id ?? null,
    });
    return { success: true, noop: true, detail: { reason, invoice_id: result.invoice_id } };
  }

  if (updated) {
    await writeAgreementWebhookAudit(admin, "tripletex_provider_webhook_paid_applied", {
      event_id: eventId,
      event_type: eventType,
      provider_id: providerId,
      tripletex_invoice_id: tripletexInvoiceId,
      invoice_id: result.invoice_id ?? null,
      previous_status: result.previous_status ?? null,
    });
  }

  return { success: true, detail: { updated, invoice_id: result.invoice_id } };
}

export async function handleTripletexProviderPaidStatusUpdate(
  payload: TripletexWebhookPayload,
  admin: SupabaseClient,
  ctx: { providerId: string; env: "test" | "prod"; eventId: string; eventType: string },
): Promise<AgreementWebhookHandlerResult> {
  const ids: string[] = [];

  if (ctx.eventType === "closegroup.create") {
    ids.push(...extractInvoiceIdsFromCloseGroup(payload.value ?? null));
  }

  const primaryId = tripletexObjectId(payload);
  if (primaryId && !ids.includes(primaryId)) ids.push(primaryId);

  if (ids.length === 0) {
    return { success: true, noop: true, detail: { reason: "NO_INVOICE_ID" } };
  }

  let anyUpdated = false;
  let lastNoop: AgreementWebhookHandlerResult | null = null;
  let lastPending: AgreementWebhookHandlerResult | null = null;
  let lastError: AgreementWebhookHandlerResult | null = null;

  for (const tripletexInvoiceId of ids) {
    const result = await applyPaidIfVerified({
      admin,
      providerId: ctx.providerId,
      env: ctx.env,
      tripletexInvoiceId,
      eventId: ctx.eventId,
      eventType: ctx.eventType,
    });

    if (result.pending) {
      lastPending = result;
      continue;
    }
    if (!result.success) {
      lastError = result;
      continue;
    }
    if (result.detail?.updated) anyUpdated = true;
    else lastNoop = result;
  }

  if (lastPending) return lastPending;
  if (anyUpdated) return { success: true, detail: { updated: true } };
  if (lastError) return lastError;
  return lastNoop ?? { success: true, noop: true };
}

const PAID_STATUS_EVENTS = new Set([
  "invoice.paid",
  "closegroup.create",
  "order.update",
]);

export function isProviderPaidStatusWebhookEvent(eventType: string): boolean {
  return PAID_STATUS_EVENTS.has(safeStr(eventType));
}

export async function dispatchProviderTripletexWebhookEvent(
  eventType: string,
  payload: TripletexWebhookPayload,
  admin: SupabaseClient,
  ctx: { providerId: string; env: "test" | "prod"; eventId: string },
): Promise<AgreementWebhookHandlerResult> {
  if (!isProviderPaidStatusWebhookEvent(eventType)) {
    return { success: true, noop: true, detail: { reason: "UNSUPPORTED_EVENT" } };
  }
  return handleTripletexProviderPaidStatusUpdate(payload, admin, {
    ...ctx,
    eventType,
  });
}
