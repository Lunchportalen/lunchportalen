// lib/saas/billing.ts
import "server-only";

import Stripe from "stripe";
import { attachAiUsageToStripeInvoice } from "@/lib/ai/billing";
import { isOnlinePaymentAllowed } from "@/lib/billing/paymentPolicy";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SaasPlan } from "@/lib/saas/tenant";
import { opsLog } from "@/lib/ops/log";

export { isSaasPlan } from "@/lib/saas/tenant";

function trimEnv(k: string): string {
  return String(process.env[k] ?? "").trim();
}

export function stripeSecretKeyConfigured(): boolean {
  return Boolean(trimEnv("STRIPE_SECRET_KEY"));
}

export function getStripe(): Stripe | null {
  const key = trimEnv("STRIPE_SECRET_KEY");
  if (!key) return null;
  return new Stripe(key, { typescript: true });
}

export function priceIdForPlan(plan: Exclude<SaasPlan, "none">): string | null {
  const map: Record<Exclude<SaasPlan, "none">, string> = {
    basic: trimEnv("STRIPE_PRICE_BASIC"),
    pro: trimEnv("STRIPE_PRICE_PRO"),
    enterprise: trimEnv("STRIPE_PRICE_ENTERPRISE"),
  };
  const v = map[plan];
  return v || null;
}

export function publicAppUrl(): string {
  const u = trimEnv("NEXT_PUBLIC_APP_URL") || trimEnv("VERCEL_URL");
  if (!u) return "http://localhost:3000";
  if (u.startsWith("http://") || u.startsWith("https://")) return u.replace(/\/$/, "");
  return `https://${u}`.replace(/\/$/, "");
}

export async function createStripeCustomerForCompany(params: {
  companyId: string;
  companyName: string;
  email: string | null;
}): Promise<{ customerId: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "STRIPE_NOT_CONFIGURED" };

  const customer = await stripe.customers.create({
    name: params.companyName,
    email: params.email ?? undefined,
    metadata: { company_id: params.companyId },
  });

  return { customerId: customer.id };
}

export async function ensureSubscriptionRow(params: {
  companyId: string;
  stripeCustomerId: string | null;
  plan?: SaasPlan;
}): Promise<void> {
  const admin = supabaseAdmin();
  const plan = params.plan ?? "none";
  const { data: existing } = await admin.from("saas_subscriptions").select("id").eq("company_id", params.companyId).maybeSingle();
  if (existing?.id) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (params.stripeCustomerId != null) patch.stripe_customer_id = params.stripeCustomerId;
    await admin.from("saas_subscriptions").update(patch).eq("company_id", params.companyId);
    return;
  }
  await admin.from("saas_subscriptions").insert({
    company_id: params.companyId,
    stripe_customer_id: params.stripeCustomerId,
    plan,
    status: "inactive",
  });
}

export async function ensureStripeCustomerForCompany(params: {
  companyId: string;
  companyName: string;
  email: string | null;
}): Promise<{ customerId: string } | { error: string }> {
  const admin = supabaseAdmin();
  const { data: row } = await admin
    .from("saas_subscriptions")
    .select("stripe_customer_id")
    .eq("company_id", params.companyId)
    .maybeSingle();
  const existing = String(row?.stripe_customer_id ?? "").trim();
  if (existing) return { customerId: existing };

  const created = await createStripeCustomerForCompany(params);
  if ("error" in created) return created;
  await ensureSubscriptionRow({ companyId: params.companyId, stripeCustomerId: created.customerId, plan: "none" });
  return { customerId: created.customerId };
}

export async function createCheckoutSession(params: {
  companyId: string;
  plan: Exclude<SaasPlan, "none">;
  customerId: string;
  successPath?: string;
  cancelPath?: string;
}): Promise<{ url: string } | { error: string }> {
  if (!isOnlinePaymentAllowed()) {
    opsLog("unauthorized_payment_attempt", { surface: "createCheckoutSession", companyId: params.companyId });
    return { error: "ONLINE_PAYMENT_DISABLED" };
  }
  const stripe = getStripe();
  if (!stripe) return { error: "STRIPE_NOT_CONFIGURED" };
  const price = priceIdForPlan(params.plan);
  if (!price) return { error: "STRIPE_PRICE_MISSING" };

  const base = publicAppUrl();
  const success = `${base}${params.successPath ?? "/saas/billing?checkout=success"}`;
  const cancel = `${base}${params.cancelPath ?? "/saas/plans"}`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: params.customerId,
    line_items: [{ price, quantity: 1 }],
    success_url: success,
    cancel_url: cancel,
    client_reference_id: params.companyId,
    subscription_data: {
      metadata: { company_id: params.companyId, plan: params.plan },
    },
    metadata: { company_id: params.companyId, plan: params.plan },
  });

  if (!session.url) return { error: "STRIPE_CHECKOUT_NO_URL" };
  return { url: session.url };
}

export async function createBillingPortalSession(params: { customerId: string; returnPath?: string }): Promise<{ url: string } | { error: string }> {
  if (!isOnlinePaymentAllowed()) {
    opsLog("unauthorized_payment_attempt", { surface: "createBillingPortalSession" });
    return { error: "ONLINE_PAYMENT_DISABLED" };
  }
  const stripe = getStripe();
  if (!stripe) return { error: "STRIPE_NOT_CONFIGURED" };
  const base = publicAppUrl();
  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: `${base}${params.returnPath ?? "/saas/billing"}`,
  });
  return { url: session.url };
}

function planFromMetadata(meta: Stripe.Metadata | null | undefined): SaasPlan {
  const p = String(meta?.plan ?? meta?.saas_plan ?? "").toLowerCase();
  if (p === "basic" || p === "pro" || p === "enterprise") return p;
  return "none";
}

export async function handleStripeWebhook(rawBody: string, signature: string | null): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  const secret = trimEnv("STRIPE_WEBHOOK_SECRET");
  if (!secret) return { ok: false, message: "Webhook ikke konfigurert.", code: "WEBHOOK_SECRET_MISSING" };
  const stripe = getStripe();
  if (!stripe) return { ok: false, message: "Stripe ikke konfigurert.", code: "STRIPE_NOT_CONFIGURED" };

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? "", secret);
  } catch {
    return { ok: false, message: "Ugyldig signatur.", code: "INVALID_SIGNATURE" };
  }

  const admin = supabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = String(session.metadata?.company_id ?? session.client_reference_id ?? "").trim();
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const plan = planFromMetadata(session.metadata);
        if (!companyId) break;
        await ensureSubscriptionRow({ companyId, stripeCustomerId: customerId ?? null, plan });
        if (subId) {
          const stripeSub = await stripe.subscriptions.retrieve(subId);
          const end = stripeSub.current_period_end
            ? new Date(stripeSub.current_period_end * 1000).toISOString()
            : null;
          await admin
            .from("saas_subscriptions")
            .update({
              stripe_subscription_id: stripeSub.id,
              plan,
              status: stripeSub.status,
              current_period_end: end,
              updated_at: new Date().toISOString(),
            })
            .eq("company_id", companyId);
        }
        await admin.from("companies").update({ saas_plan: plan }).eq("id", companyId);
        break;
      }
      case "invoice.created": {
        const inv = event.data.object as Stripe.Invoice;
        try {
          const res = await attachAiUsageToStripeInvoice({ stripe, invoice: inv });
          if (res.ok === false) {
            opsLog("stripe_invoice_ai_usage", {
              invoiceId: inv.id,
              ok: false,
              message: res.message,
            });
          } else if (res.skipped) {
            opsLog("stripe_invoice_ai_usage", {
              invoiceId: inv.id,
              skipped: true,
              reason: res.reason,
            });
          } else if (res.ok && res.skipped === false) {
            const snap = res.snapshot;
            opsLog("stripe_invoice_ai_usage", {
              invoiceId: inv.id,
              companyId: snap.company_id,
              costUsd: snap.estimated_cost_usd,
              overageUsd: snap.overage_cost_usd,
              flagged: snap.flagged_over_included,
              invoiceItemId: res.invoice_item_id ?? null,
            });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          opsLog("stripe_invoice_ai_usage", { invoiceId: inv.id, ok: false, thrown: true, message: msg });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const companyId = String(sub.metadata?.company_id ?? "").trim();
        const plan = planFromMetadata(sub.metadata);
        const end = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
        if (companyId) {
          await admin
            .from("saas_subscriptions")
            .update({
              stripe_subscription_id: sub.id,
              plan: plan === "none" ? "none" : plan,
              status,
              current_period_end: end,
              updated_at: new Date().toISOString(),
            })
            .eq("company_id", companyId);
          const effectivePlan = status === "active" || status === "trialing" ? plan : "none";
          await admin.from("companies").update({ saas_plan: effectivePlan }).eq("id", companyId);
        } else if (sub.id) {
          await admin
            .from("saas_subscriptions")
            .update({
              status,
              current_period_end: end,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", sub.id);
        }
        break;
      }
      default:
        break;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "WEBHOOK_HANDLER_ERROR";
    return { ok: false, message: msg, code: "WEBHOOK_HANDLER_ERROR" };
  }

  return { ok: true };
}
