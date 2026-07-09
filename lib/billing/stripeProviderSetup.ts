import "server-only";

import Stripe from "stripe";

import { publicAppUrl } from "@/lib/saas/billing";
import { supabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdminLike = ReturnType<typeof supabaseAdmin>;

export type StripeSetupDeps = {
  stripe?: Stripe;
  admin?: SupabaseAdminLike;
};

export type StartProviderStripeSetupInput = {
  providerId: string;
  actorUserId: string;
  actorEmail?: string | null;
  successPath?: string | null;
  cancelPath?: string | null;
};

export type StartProviderStripeSetupResult =
  | { ok: true; url: string; sessionId: string; customerId: string }
  | { ok: false; code: string; message: string };

export type EnsureProviderStripeCustomerResult =
  | { ok: true; customerId: string }
  | { ok: false; code: string; message: string };

function trimEnv(key: string): string {
  return String(process.env[key] ?? "").trim();
}

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

export function getProviderBillingStripe(): Stripe | null {
  const key = trimEnv("STRIPE_SECRET_KEY");
  if (!key) return null;
  return new Stripe(key, { typescript: true });
}

function adminClient(deps?: StripeSetupDeps): SupabaseAdminLike {
  return deps?.admin ?? supabaseAdmin();
}

function stripeClient(deps?: StripeSetupDeps): Stripe | null {
  return deps?.stripe ?? getProviderBillingStripe();
}

function setupReturnUrl(path: string | null | undefined, fallback: string): string {
  const base = publicAppUrl();
  const p = safeStr(path) || fallback;
  if (/^https?:\/\//i.test(p)) return p;
  return `${base}${p.startsWith("/") ? p : `/${p}`}`;
}

function cardMetadata(pm: Stripe.PaymentMethod): {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
} | null {
  const card = pm.card;
  if (!card?.last4 || !card.exp_month || !card.exp_year) return null;
  return {
    brand: safeStr(card.brand).toLowerCase() || "card",
    last4: card.last4,
    expMonth: card.exp_month,
    expYear: card.exp_year,
  };
}

export async function ensureProviderStripeCustomer(
  providerId: string,
  deps?: StripeSetupDeps,
): Promise<EnsureProviderStripeCustomerResult> {
  const pid = safeStr(providerId);
  if (!pid) return { ok: false, code: "PROVIDER_ID_REQUIRED", message: "Provider mangler." };

  const admin = adminClient(deps);
  const stripe = stripeClient(deps);
  if (!stripe) return { ok: false, code: "STRIPE_NOT_CONFIGURED", message: "Stripe er ikke konfigurert." };

  const { data: profile, error } = await admin
    .from("organization_billing_profiles")
    .select("organization_id, legal_name, billing_email_current, payment_provider_customer_id")
    .eq("organization_id", pid)
    .maybeSingle();

  if (error) return { ok: false, code: "BILLING_PROFILE_READ_FAILED", message: "Kunne ikke lese billing profile." };
  if (!profile?.organization_id) return { ok: false, code: "BILLING_PROFILE_NOT_FOUND", message: "Billing profile mangler." };

  const existing = safeStr((profile as { payment_provider_customer_id?: unknown }).payment_provider_customer_id);
  if (existing) return { ok: true, customerId: existing };

  const customer = await stripe.customers.create({
    name: safeStr((profile as { legal_name?: unknown }).legal_name) || undefined,
    email: safeStr((profile as { billing_email_current?: unknown }).billing_email_current) || undefined,
    metadata: {
      organization_id: pid,
      provider_id: pid,
      lunchportalen_billing: "provider_commission",
    },
  });

  const { error: updateError } = await admin
    .from("organization_billing_profiles")
    .update({ payment_provider: "stripe", payment_provider_customer_id: customer.id })
    .eq("organization_id", pid);

  if (updateError) return { ok: false, code: "BILLING_PROFILE_UPDATE_FAILED", message: "Kunne ikke lagre Stripe customer." };

  await admin.from("billing_audit_log").insert({
    organization_id: pid,
    actor_user_id: null,
    action: "stripe_customer.created",
    after_json: { provider: "stripe", customer_id: customer.id },
    reason: "provider payment method setup",
  });

  return { ok: true, customerId: customer.id };
}

export async function createProviderPaymentSetupSession(
  input: StartProviderStripeSetupInput,
  deps?: StripeSetupDeps,
): Promise<StartProviderStripeSetupResult> {
  const providerId = safeStr(input.providerId);
  const actorUserId = safeStr(input.actorUserId);
  if (!providerId || !actorUserId) {
    return { ok: false, code: "INVALID_ARGUMENT", message: "Ugyldig setup-forespørsel." };
  }

  const stripe = stripeClient(deps);
  if (!stripe) return { ok: false, code: "STRIPE_NOT_CONFIGURED", message: "Stripe er ikke konfigurert." };

  const customer = await ensureProviderStripeCustomer(providerId, deps);
  if (customer.ok === false) return customer;

  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customer.customerId,
    client_reference_id: providerId,
    success_url: setupReturnUrl(input.successPath, "/leverandor/faktura?payment_setup=success"),
    cancel_url: setupReturnUrl(input.cancelPath, "/leverandor/faktura?payment_setup=cancel"),
    metadata: {
      organization_id: providerId,
      provider_id: providerId,
      actor_user_id: actorUserId,
      actor_email: safeStr(input.actorEmail) || "",
      purpose: "provider_commission_payment_method",
      off_session_consent: "monthly_commission_charge_future",
    },
    payment_method_types: ["card"],
  });

  if (!session.url) {
    return { ok: false, code: "STRIPE_SETUP_SESSION_NO_URL", message: "Stripe setup session mangler URL." };
  }

  return { ok: true, url: session.url, sessionId: session.id, customerId: customer.customerId };
}

async function findBillingProfileByCustomer(
  customerId: string,
  admin: SupabaseAdminLike,
): Promise<string | null> {
  const { data } = await admin
    .from("organization_billing_profiles")
    .select("organization_id")
    .eq("payment_provider_customer_id", customerId)
    .maybeSingle();
  return safeStr((data as { organization_id?: unknown } | null)?.organization_id) || null;
}

async function upsertPaymentMethodMetadata(input: {
  organizationId: string;
  customerId: string;
  paymentMethod: Stripe.PaymentMethod;
  actorUserId?: string | null;
  admin: SupabaseAdminLike;
}): Promise<boolean> {
  const metadata = cardMetadata(input.paymentMethod);
  if (!metadata) return false;

  await input.admin
    .from("payment_methods")
    .update({ status: "replaced", replaced_at: new Date().toISOString() })
    .eq("organization_id", input.organizationId)
    .in("status", ["active", "verified", "chargeable"]);

  const { data: existing } = await input.admin
    .from("payment_methods")
    .select("id")
    .eq("provider", "stripe")
    .eq("provider_payment_method_id", input.paymentMethod.id)
    .maybeSingle();

  let paymentMethodId = safeStr((existing as { id?: unknown } | null)?.id);
  if (paymentMethodId) {
    await input.admin
      .from("payment_methods")
      .update({
        organization_id: input.organizationId,
        brand: metadata.brand,
        last4: metadata.last4,
        exp_month: metadata.expMonth,
        exp_year: metadata.expYear,
        status: "chargeable",
        replaced_at: null,
      })
      .eq("id", paymentMethodId);
  } else {
    const { data: inserted, error } = await input.admin
      .from("payment_methods")
      .insert({
        organization_id: input.organizationId,
        provider: "stripe",
        provider_payment_method_id: input.paymentMethod.id,
        brand: metadata.brand,
        last4: metadata.last4,
        exp_month: metadata.expMonth,
        exp_year: metadata.expYear,
        status: "chargeable",
      })
      .select("id")
      .single();
    if (error || !inserted?.id) return false;
    paymentMethodId = inserted.id;
  }

  await input.admin
    .from("organization_billing_profiles")
    .update({
      payment_provider: "stripe",
      payment_provider_customer_id: input.customerId,
      default_payment_method_id: paymentMethodId,
      billing_status: "active",
    })
    .eq("organization_id", input.organizationId);

  await input.admin.from("billing_audit_log").insert({
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId || null,
    action: "payment_method.attached",
    after_json: {
      provider: "stripe",
      payment_method_id: input.paymentMethod.id,
      brand: metadata.brand,
      last4: metadata.last4,
      exp_month: metadata.expMonth,
      exp_year: metadata.expYear,
      status: "chargeable",
    },
    reason: "stripe setup completed",
  });

  return true;
}

async function processPaymentMethod(
  paymentMethod: Stripe.PaymentMethod,
  admin: SupabaseAdminLike,
  actorUserId?: string | null,
): Promise<boolean> {
  const customerId = typeof paymentMethod.customer === "string" ? paymentMethod.customer : paymentMethod.customer?.id;
  const cid = safeStr(customerId);
  if (!cid) return false;
  const organizationId = await findBillingProfileByCustomer(cid, admin);
  if (!organizationId) return false;
  return upsertPaymentMethodMetadata({ organizationId, customerId: cid, paymentMethod, actorUserId, admin });
}

export async function handleProviderStripeSetupWebhook(
  rawBody: string,
  signature: string | null,
  deps?: StripeSetupDeps,
): Promise<{ ok: true; duplicate?: boolean; ignored?: boolean } | { ok: false; code: string; message: string }> {
  const secret = trimEnv("STRIPE_PROVIDER_SETUP_WEBHOOK_SECRET") || trimEnv("STRIPE_WEBHOOK_SECRET");
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

  if (![
    "checkout.session.completed",
    "setup_intent.succeeded",
    "payment_method.attached",
    "customer.updated",
  ].includes(event.type)) {
    return { ok: true, ignored: true };
  }

  const { data: existing } = await admin
    .from("stripe_billing_webhook_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (existing?.id) return { ok: true, duplicate: true };

  let organizationId: string | null = null;
  let processed = false;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === "setup") {
      organizationId = safeStr(session.metadata?.organization_id ?? session.client_reference_id) || null;
      const pmId = typeof session.setup_intent === "string" ? null : safeStr(session.setup_intent?.payment_method);
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (organizationId && customerId) {
        await admin
          .from("organization_billing_profiles")
          .update({ payment_provider: "stripe", payment_provider_customer_id: customerId })
          .eq("organization_id", organizationId);
      }
      if (pmId) {
        const pm = await stripe.paymentMethods.retrieve(pmId);
        processed = await upsertPaymentMethodMetadata({
          organizationId: organizationId!,
          customerId: safeStr(customerId),
          paymentMethod: pm,
          actorUserId: safeStr(session.metadata?.actor_user_id) || null,
          admin,
        });
      } else {
        processed = Boolean(organizationId && customerId);
      }
    }
  } else if (event.type === "setup_intent.succeeded") {
    const intent = event.data.object as Stripe.SetupIntent;
    const pmId = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
    const customerId = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
    organizationId = safeStr(intent.metadata?.organization_id) || (customerId ? await findBillingProfileByCustomer(customerId, admin) : null);
    if (pmId && organizationId && customerId) {
      const pm = await stripe.paymentMethods.retrieve(pmId);
      processed = await upsertPaymentMethodMetadata({
        organizationId,
        customerId,
        paymentMethod: pm,
        actorUserId: safeStr(intent.metadata?.actor_user_id) || null,
        admin,
      });
    }
  } else if (event.type === "payment_method.attached") {
    const pm = event.data.object as Stripe.PaymentMethod;
    const customerId = typeof pm.customer === "string" ? pm.customer : pm.customer?.id;
    organizationId = customerId ? await findBillingProfileByCustomer(customerId, admin) : null;
    processed = await processPaymentMethod(pm, admin);
  } else if (event.type === "customer.updated") {
    const customer = event.data.object as Stripe.Customer;
    organizationId = safeStr(customer.metadata?.organization_id) || await findBillingProfileByCustomer(customer.id, admin);
    processed = Boolean(organizationId);
  }

  const { error: insertError } = await admin.from("stripe_billing_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    organization_id: organizationId,
    status: processed ? "processed" : "ignored",
  });
  if (insertError?.code === "23505") return { ok: true, duplicate: true };
  if (insertError) return { ok: false, code: "WEBHOOK_IDEMPOTENCY_WRITE_FAILED", message: "Kunne ikke lagre webhook-idempotency." };

  return { ok: true, ignored: !processed };
}
