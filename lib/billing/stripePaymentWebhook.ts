import "server-only";

import type Stripe from "stripe";

import { getProviderBillingStripe } from "@/lib/billing/stripeProviderSetup";
import { supabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdminLike = ReturnType<typeof supabaseAdmin>;

export type StripePaymentWebhookDeps = {
  stripe?: Stripe;
  admin?: SupabaseAdminLike;
};

export type StripePaymentWebhookResult =
  | { ok: true; duplicate?: boolean; ignored?: boolean; unmatched?: boolean }
  | { ok: false; code: string; message: string };

const PAYMENT_EVENT_TYPES = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.processing",
  "payment_intent.requires_action",
  "charge.succeeded",
  "charge.failed",
]);

function trimEnv(key: string): string {
  return String(process.env[key] ?? "").trim();
}

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function adminClient(deps?: StripePaymentWebhookDeps): SupabaseAdminLike {
  return deps?.admin ?? supabaseAdmin();
}

function stripeClient(deps?: StripePaymentWebhookDeps): Stripe | null {
  return deps?.stripe ?? getProviderBillingStripe();
}

function paymentIntentIdFromEvent(event: Stripe.Event): string | null {
  const object = event.data.object as any;
  if (String(event.type).startsWith("payment_intent.")) return safeStr(object?.id) || null;
  if (String(event.type).startsWith("charge.")) {
    return safeStr(object?.payment_intent) || null;
  }
  return null;
}

function safeFailure(intentOrCharge: any): { code: string | null; message: string | null } {
  const err = intentOrCharge?.last_payment_error ?? null;
  const code =
    safeStr(err?.decline_code) ||
    safeStr(err?.code) ||
    safeStr(intentOrCharge?.failure_code) ||
    null;
  const message = (safeStr(err?.message) || safeStr(intentOrCharge?.failure_message) || "").slice(0, 300) || null;
  return { code, message };
}

function statusForEvent(event: Stripe.Event): {
  attemptStatus: "processing" | "succeeded" | "failed" | "requires_action";
  invoiceStatus: "processing" | "paid" | "failed" | "action_required";
  requiresAction: boolean;
} {
  if (event.type === "payment_intent.succeeded" || event.type === "charge.succeeded") {
    return { attemptStatus: "succeeded", invoiceStatus: "paid", requiresAction: false };
  }
  if (event.type === "payment_intent.processing") {
    return { attemptStatus: "processing", invoiceStatus: "processing", requiresAction: false };
  }
  if (event.type === "payment_intent.requires_action") {
    return { attemptStatus: "requires_action", invoiceStatus: "action_required", requiresAction: true };
  }
  const object = event.data.object as any;
  const failure = safeFailure(object);
  if (failure.code === "authentication_required" || object?.status === "requires_action") {
    return { attemptStatus: "requires_action", invoiceStatus: "action_required", requiresAction: true };
  }
  return { attemptStatus: "failed", invoiceStatus: "failed", requiresAction: false };
}

async function insertWebhookEvent(input: {
  admin: SupabaseAdminLike;
  eventId: string;
  eventType: string;
  organizationId: string | null;
  status: "processed" | "ignored" | "unmatched" | "failed";
}): Promise<"inserted" | "duplicate" | "failed"> {
  const { data: existing } = await input.admin
    .from("stripe_billing_webhook_events")
    .select("id")
    .eq("stripe_event_id", input.eventId)
    .maybeSingle();
  if (existing?.id) return "duplicate";

  const { error } = await input.admin.from("stripe_billing_webhook_events").insert({
    stripe_event_id: input.eventId,
    event_type: input.eventType,
    organization_id: input.organizationId,
    status: input.status,
  });
  if (error?.code === "23505") return "duplicate";
  if (error) return "failed";
  return "inserted";
}

export async function handleProviderStripePaymentWebhook(
  rawBody: string,
  signature: string | null,
  deps?: StripePaymentWebhookDeps,
): Promise<StripePaymentWebhookResult> {
  const secret = trimEnv("STRIPE_BILLING_PAYMENTS_WEBHOOK_SECRET") || trimEnv("STRIPE_WEBHOOK_SECRET");
  if (!secret) return { ok: false, code: "WEBHOOK_SECRET_MISSING", message: "Stripe webhook secret mangler." };
  const stripe = stripeClient(deps);
  if (!stripe) return { ok: false, code: "STRIPE_NOT_CONFIGURED", message: "Stripe er ikke konfigurert." };
  const admin = adminClient(deps);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? "", secret);
  } catch {
    return { ok: false, code: "INVALID_SIGNATURE", message: "Ugyldig Stripe-signatur." };
  }

  if (!PAYMENT_EVENT_TYPES.has(event.type)) {
    return { ok: true, ignored: true };
  }

  const eventId = safeStr(event.id);
  if (!eventId) return { ok: false, code: "STRIPE_EVENT_ID_MISSING", message: "Stripe event id mangler." };

  const paymentIntentId = paymentIntentIdFromEvent(event);
  if (!paymentIntentId) {
    const inserted = await insertWebhookEvent({ admin, eventId, eventType: event.type, organizationId: null, status: "ignored" });
    if (inserted === "duplicate") return { ok: true, duplicate: true };
    return { ok: true, ignored: true };
  }

  const { data: attempt } = await admin
    .from("billing_payment_attempts")
    .select("id, provider_invoice_id, provider_id, organization_id, status")
    .eq("provider_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (!attempt?.id) {
    const inserted = await insertWebhookEvent({ admin, eventId, eventType: event.type, organizationId: null, status: "unmatched" });
    if (inserted === "duplicate") return { ok: true, duplicate: true };
    return { ok: true, unmatched: true };
  }

  const inserted = await insertWebhookEvent({
    admin,
    eventId,
    eventType: event.type,
    organizationId: safeStr((attempt as any).organization_id) || null,
    status: "processed",
  });
  if (inserted === "duplicate") return { ok: true, duplicate: true };
  if (inserted === "failed") return { ok: false, code: "WEBHOOK_IDEMPOTENCY_WRITE_FAILED", message: "Kunne ikke lagre webhook-idempotency." };

  const status = statusForEvent(event);
  const failure = safeFailure((event.data.object as any) ?? {});
  const paidAt = status.invoiceStatus === "paid" ? new Date().toISOString() : null;

  await admin
    .from("billing_payment_attempts")
    .update({
      status: status.attemptStatus,
      requires_action: status.requiresAction,
      failure_code: failure.code,
      failure_message_safe: failure.message,
    })
    .eq("id", (attempt as any).id);

  const invoicePatch: Record<string, unknown> = { payment_status: status.invoiceStatus };
  if (paidAt) invoicePatch.paid_at = paidAt;

  await admin
    .from("provider_commission_invoices")
    .update(invoicePatch)
    .eq("id", (attempt as any).provider_invoice_id);

  await admin.rpc("lp_billing_apply_payment_recovery_policy", {
    p_provider_invoice_id: (attempt as any).provider_invoice_id,
    p_payment_status: status.invoiceStatus,
    p_failure_code: failure.code,
    p_failure_message_safe: failure.message,
  });

  await admin.from("billing_audit_log").insert({
    organization_id: (attempt as any).organization_id,
    actor_user_id: null,
    action: event.type,
    after_json: {
      provider_invoice_id: (attempt as any).provider_invoice_id,
      payment_attempt_id: (attempt as any).id,
      stripe_payment_intent_id: paymentIntentId,
      attempt_status: status.attemptStatus,
      invoice_payment_status: status.invoiceStatus,
      requires_action: status.requiresAction,
      failure_code: failure.code,
    },
    reason: "stripe payment webhook accounting",
  });

  return { ok: true };
}
