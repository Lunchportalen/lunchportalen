import "server-only";

import type Stripe from "stripe";

import { getProviderBillingStripe } from "@/lib/billing/stripeProviderSetup";
import { supabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdminLike = ReturnType<typeof supabaseAdmin>;

export type StripeChargeDeps = {
  stripe?: Stripe;
  admin?: SupabaseAdminLike;
};

export type ChargeProviderInvoiceInput = {
  providerInvoiceId: string;
  actorUserId?: string | null;
  idempotencyKey?: string | null;
};

export type ChargeProviderInvoiceResult =
  | {
      ok: true;
      providerInvoiceId: string;
      paymentAttemptId: string;
      stripePaymentIntentId: string | null;
      paymentStatus: "processing" | "paid" | "failed" | "action_required";
      stripeStatus: string;
      requiresAction: boolean;
      chargeSucceeded: boolean;
      chargeFailed: boolean;
      createdNew: boolean;
      idempotencyKey: string;
    }
  | { ok: false; code: string; message: string; missingRequirements?: string[] };

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function adminClient(deps?: StripeChargeDeps): SupabaseAdminLike {
  return deps?.admin ?? supabaseAdmin();
}

function stripeClient(deps?: StripeChargeDeps): Stripe | null {
  return deps?.stripe ?? getProviderBillingStripe();
}

function normalizeStripeFailure(error: unknown): { code: string; message: string } {
  const err = error as { code?: unknown; decline_code?: unknown; message?: unknown; type?: unknown };
  const code = safeStr(err?.decline_code) || safeStr(err?.code) || safeStr(err?.type) || "stripe_error";
  const message = safeStr(err?.message).slice(0, 300) || "Stripe charge failed";
  return { code, message };
}

function invoiceStatusForStripeStatus(status: string): "processing" | "paid" | "failed" | "action_required" {
  if (status === "succeeded") return "paid";
  if (status === "processing") return "processing";
  if (status === "requires_action") return "action_required";
  return "failed";
}

function attemptStatusForStripeStatus(status: string): "processing" | "succeeded" | "failed" | "requires_action" {
  if (status === "succeeded") return "succeeded";
  if (status === "processing") return "processing";
  if (status === "requires_action") return "requires_action";
  return "failed";
}

async function loadExistingAttempt(admin: SupabaseAdminLike, idempotencyKey: string) {
  const { data } = await admin
    .from("billing_payment_attempts")
    .select("id, provider_invoice_id, provider_payment_intent_id, status, requires_action, idempotency_key")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

export async function chargeProviderCommissionInvoice(
  input: ChargeProviderInvoiceInput,
  deps?: StripeChargeDeps,
): Promise<ChargeProviderInvoiceResult> {
  const providerInvoiceId = safeStr(input.providerInvoiceId);
  if (!providerInvoiceId) return { ok: false, code: "PROVIDER_INVOICE_ID_REQUIRED", message: "Invoice id mangler." };

  const idempotencyKey = safeStr(input.idempotencyKey) || `stripe-charge:${providerInvoiceId}`;
  const admin = adminClient(deps);
  const stripe = stripeClient(deps);
  if (!stripe) return { ok: false, code: "STRIPE_NOT_CONFIGURED", message: "Stripe er ikke konfigurert." };

  const existing = await loadExistingAttempt(admin, idempotencyKey);
  if (existing?.id) {
    const attemptStatus = safeStr(existing.status);
    const paymentStatus = attemptStatus === "succeeded" ? "paid" : attemptStatus === "requires_action" ? "action_required" : attemptStatus === "failed" ? "failed" : "processing";
    return {
      ok: true,
      providerInvoiceId: safeStr(existing.provider_invoice_id) || providerInvoiceId,
      paymentAttemptId: safeStr(existing.id),
      stripePaymentIntentId: safeStr(existing.provider_payment_intent_id) || null,
      paymentStatus,
      stripeStatus: attemptStatus,
      requiresAction: Boolean(existing.requires_action),
      chargeSucceeded: attemptStatus === "succeeded",
      chargeFailed: attemptStatus === "failed",
      createdNew: false,
      idempotencyKey,
    };
  }

  const { data: previewRaw, error: previewError } = await admin.rpc("lp_billing_stripe_charge_dry_run", {
    p_provider_invoice_id: providerInvoiceId,
    p_idempotency_key: idempotencyKey,
  });
  if (previewError) return { ok: false, code: "CHARGE_DRY_RUN_FAILED", message: safeStr(previewError.message) || "Charge preview feilet." };

  const preview = Array.isArray(previewRaw) ? previewRaw[0] : previewRaw;
  const missing = Array.isArray(preview?.missing_requirements) ? preview.missing_requirements.map(String) : [];
  if (!preview?.can_create_payment_intent) {
    return { ok: false, code: "CHARGE_PREVIEW_BLOCKED", message: "Invoice er ikke klar for korttrekk.", missingRequirements: missing };
  }

  const { data: invoice } = await admin
    .from("provider_commission_invoices")
    .select("id, provider_id, organization_id, commission_period_id, total_amount_minor, currency, payment_status")
    .eq("id", providerInvoiceId)
    .maybeSingle();
  if (!invoice?.id) return { ok: false, code: "PROVIDER_INVOICE_NOT_FOUND", message: "Invoice finnes ikke." };

  const { data: profile } = await admin
    .from("organization_billing_profiles")
    .select("organization_id, payment_provider_customer_id, default_payment_method_id")
    .eq("organization_id", invoice.provider_id)
    .maybeSingle();
  if (!profile?.payment_provider_customer_id || !profile?.default_payment_method_id) {
    return { ok: false, code: "PAYMENT_PROFILE_INCOMPLETE", message: "Payment profile mangler customer eller betalingsmetode." };
  }

  const { data: method } = await admin
    .from("payment_methods")
    .select("id, provider_payment_method_id, status")
    .eq("id", profile.default_payment_method_id)
    .eq("organization_id", invoice.provider_id)
    .maybeSingle();
  if (!method?.provider_payment_method_id || !["active", "verified", "chargeable"].includes(safeStr(method.status))) {
    return { ok: false, code: "PAYMENT_METHOD_NOT_CHARGEABLE", message: "Betalingsmetode er ikke trekkbar." };
  }

  const amount = Number(invoice.total_amount_minor);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, code: "AMOUNT_NOT_POSITIVE", message: "Invoice-beløp er ikke gyldig." };
  }

  const { data: attemptInserted, error: attemptInsertError } = await admin
    .from("billing_payment_attempts")
    .insert({
      provider_invoice_id: providerInvoiceId,
      provider_id: invoice.provider_id,
      organization_id: invoice.organization_id,
      payment_provider: "stripe",
      provider_customer_id_reference: profile.payment_provider_customer_id,
      amount_minor: amount,
      currency: safeStr(invoice.currency).toUpperCase(),
      status: "processing",
      requires_action: false,
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (attemptInsertError?.code === "23505") {
    const duplicate = await loadExistingAttempt(admin, idempotencyKey);
    if (duplicate?.id) {
      return {
        ok: true,
        providerInvoiceId,
        paymentAttemptId: safeStr(duplicate.id),
        stripePaymentIntentId: safeStr(duplicate.provider_payment_intent_id) || null,
        paymentStatus: "processing",
        stripeStatus: safeStr(duplicate.status) || "processing",
        requiresAction: Boolean(duplicate.requires_action),
        chargeSucceeded: safeStr(duplicate.status) === "succeeded",
        chargeFailed: safeStr(duplicate.status) === "failed",
        createdNew: false,
        idempotencyKey,
      };
    }
  }
  if (attemptInsertError || !attemptInserted?.id) {
    return { ok: false, code: "PAYMENT_ATTEMPT_CREATE_FAILED", message: "Kunne ikke opprette payment attempt." };
  }

  const metadata = {
    ...(preview.stripe_preview_metadata ?? {}),
    payment_attempt_id: attemptInserted.id,
  };

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount,
        currency: safeStr(invoice.currency).toLowerCase(),
        customer: profile.payment_provider_customer_id,
        payment_method: method.provider_payment_method_id,
        off_session: true,
        confirm: true,
        metadata,
      },
      { idempotencyKey },
    );

    const attemptStatus = attemptStatusForStripeStatus(intent.status);
    const invoicePaymentStatus = invoiceStatusForStripeStatus(intent.status);
    const requiresAction = intent.status === "requires_action";

    await admin
      .from("billing_payment_attempts")
      .update({
        provider_payment_intent_id: intent.id,
        status: attemptStatus,
        requires_action: requiresAction,
      })
      .eq("id", attemptInserted.id);

    await admin
      .from("provider_commission_invoices")
      .update({
        payment_provider_payment_intent_id: intent.id,
        payment_status: invoicePaymentStatus,
        paid_at: intent.status === "succeeded" ? new Date().toISOString() : null,
      })
      .eq("id", providerInvoiceId);

    await admin.from("billing_audit_log").insert({
      organization_id: invoice.provider_id,
      actor_user_id: input.actorUserId || null,
      action: "stripe_charge.attempted",
      after_json: {
        provider_invoice_id: providerInvoiceId,
        payment_attempt_id: attemptInserted.id,
        stripe_payment_intent_id: intent.id,
        stripe_status: intent.status,
        invoice_payment_status: invoicePaymentStatus,
      },
      reason: "single invoice off-session charge",
    });

    return {
      ok: true,
      providerInvoiceId,
      paymentAttemptId: attemptInserted.id,
      stripePaymentIntentId: intent.id,
      paymentStatus: invoicePaymentStatus,
      stripeStatus: intent.status,
      requiresAction,
      chargeSucceeded: intent.status === "succeeded",
      chargeFailed: attemptStatus === "failed",
      createdNew: true,
      idempotencyKey,
    };
  } catch (error) {
    const failure = normalizeStripeFailure(error);
    await admin
      .from("billing_payment_attempts")
      .update({
        status: failure.code === "authentication_required" ? "requires_action" : "failed",
        failure_code: failure.code,
        failure_message_safe: failure.message,
        requires_action: failure.code === "authentication_required",
      })
      .eq("id", attemptInserted.id);

    await admin
      .from("provider_commission_invoices")
      .update({
        payment_status: failure.code === "authentication_required" ? "action_required" : "failed",
      })
      .eq("id", providerInvoiceId);

    return {
      ok: true,
      providerInvoiceId,
      paymentAttemptId: attemptInserted.id,
      stripePaymentIntentId: null,
      paymentStatus: failure.code === "authentication_required" ? "action_required" : "failed",
      stripeStatus: failure.code,
      requiresAction: failure.code === "authentication_required",
      chargeSucceeded: false,
      chargeFailed: failure.code !== "authentication_required",
      createdNew: true,
      idempotencyKey,
    };
  }
}
