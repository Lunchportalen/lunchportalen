import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import type {
  ProviderBillingBundle,
  ProviderInvoiceRow,
  ProviderSubscriptionRow,
} from "@/lib/providers/providerBillingShared";

export type {
  ProviderBillingBundle,
  ProviderInvoiceRow,
  ProviderSubscriptionRow,
} from "@/lib/providers/providerBillingShared";
export { INVOICE_STATUS_LABELS, PLAN_LABELS } from "@/lib/providers/providerBillingShared";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function loadProviderBilling(providerId: string): Promise<ProviderBillingBundle> {
  const sb = await supabaseServer();

  const { data: subRows, error: subErr } = await sb
    .from("provider_subscriptions")
    .select(
      "id, provider_id, plan, monthly_amount, currency, tax_code_id, billing_email, billing_org_number, billing_address, active_from, status, notes",
    )
    .eq("provider_id", providerId)
    .is("active_to", null)
    .order("active_from", { ascending: false })
    .limit(1);

  if (subErr) throw new Error(subErr.message);

  let activeSubscription: ProviderSubscriptionRow | null = null;
  const sub = Array.isArray(subRows) ? subRows[0] : null;

  if (sub) {
    const { data: tax } = await sb
      .from("billing_tax_codes")
      .select("rate")
      .eq("id", safeStr(sub.tax_code_id))
      .maybeSingle();

    activeSubscription = {
      id: safeStr(sub.id),
      provider_id: safeStr(sub.provider_id),
      plan: safeStr(sub.plan),
      monthly_amount: num(sub.monthly_amount),
      currency: safeStr(sub.currency) || "NOK",
      tax_code_id: safeStr(sub.tax_code_id),
      tax_rate: num(tax?.rate),
      billing_email: safeStr(sub.billing_email),
      billing_org_number: sub.billing_org_number ?? null,
      billing_address: sub.billing_address ?? null,
      active_from: safeStr(sub.active_from),
      status: safeStr(sub.status),
      notes: sub.notes ?? null,
    };
  }

  const { data: invRows, error: invErr } = await sb
    .from("provider_invoices")
    .select(
      "id, invoice_number, invoice_period, amount_net, amount_tax, amount_total, status, due_date, sent_at, paid_at, created_at",
    )
    .eq("provider_id", providerId)
    .order("invoice_period", { ascending: false })
    .limit(24);

  if (invErr) throw new Error(invErr.message);

  const invoices: ProviderInvoiceRow[] = (Array.isArray(invRows) ? invRows : []).map((row) => ({
    id: safeStr(row.id),
    invoice_number: row.invoice_number ?? null,
    invoice_period: safeStr(row.invoice_period),
    amount_net: num(row.amount_net),
    amount_tax: num(row.amount_tax),
    amount_total: num(row.amount_total),
    status: safeStr(row.status),
    due_date: row.due_date ?? null,
    sent_at: row.sent_at ?? null,
    paid_at: row.paid_at ?? null,
    created_at: safeStr(row.created_at),
  }));

  return { activeSubscription, invoices };
}

export async function loadAllProvidersWithSubscriptions(): Promise<
  Array<{
    id: string;
    name: string;
    slug: string;
    contact_email: string;
    has_subscription: boolean;
    plan: string | null;
    monthly_amount: number | null;
  }>
> {
  const sb = await supabaseServer();
  const { data: providers, error } = await sb
    .from("providers")
    .select("id, name, slug, contact_email")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  const list = Array.isArray(providers) ? providers : [];
  const ids = list.map((p) => safeStr(p.id)).filter(Boolean);

  const subByProvider = new Map<string, { plan: string; monthly_amount: number }>();
  if (ids.length) {
    const { data: subs } = await sb
      .from("provider_subscriptions")
      .select("provider_id, plan, monthly_amount")
      .in("provider_id", ids)
      .is("active_to", null);

    for (const s of Array.isArray(subs) ? subs : []) {
      subByProvider.set(safeStr(s.provider_id), {
        plan: safeStr(s.plan),
        monthly_amount: num(s.monthly_amount),
      });
    }
  }

  return list.map((p) => {
    const id = safeStr(p.id);
    const sub = subByProvider.get(id);
    return {
      id,
      name: safeStr(p.name),
      slug: safeStr(p.slug),
      contact_email: safeStr(p.contact_email),
      has_subscription: Boolean(sub),
      plan: sub?.plan ?? null,
      monthly_amount: sub?.monthly_amount ?? null,
    };
  });
}
