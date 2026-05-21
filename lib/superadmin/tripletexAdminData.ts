import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

export type TripletexOverviewStats = {
  activeProviders: number;
  tripletexMappedProviders: number;
  outboxPending: number;
  outboxFailed: number;
  invoicesSent: number;
  invoicesPaid: number;
  invoicesDraft: number;
  webhooksFailed: number;
};

export type WebhookEventRow = {
  id: string;
  event_id: string;
  event_type: string;
  status: string;
  received_at: string;
  processed_at: string | null;
  error_detail: string | null;
};

export type TripletexOutboxRow = {
  id: string;
  event_key: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  next_retry_at: string | null;
};

export type ProviderInvoiceRow = {
  id: string;
  invoice_number: string | null;
  provider_id: string;
  provider_name: string;
  invoice_period: string;
  amount_total: number;
  status: string;
  tripletex_invoice_id: string | null;
  unique_ref: string | null;
};

export type ProviderTripletexSyncRow = {
  provider_id: string;
  provider_name: string;
  provider_slug: string;
  tripletex_customer_id: string | null;
  has_mapping: boolean;
};

export async function loadTripletexOverviewStats(): Promise<TripletexOverviewStats> {
  const admin = supabaseAdmin();

  const [providersRes, mappedRes, outboxPendingRes, outboxFailedRes, invSent, invPaid, invDraft, whFailed] =
    await Promise.all([
      admin.from("providers").select("id", { count: "exact", head: true }),
      admin.from("tripletex_customers").select("id", { count: "exact", head: true }).not("provider_id", "is", null),
      admin
        .from("outbox")
        .select("id", { count: "exact", head: true })
        .like("event_key", "tripletex.%")
        .eq("status", "PENDING"),
      admin
        .from("outbox")
        .select("id", { count: "exact", head: true })
        .like("event_key", "tripletex.%")
        .in("status", ["FAILED", "FAILED_PERMANENT"]),
      admin.from("provider_invoices").select("id", { count: "exact", head: true }).eq("status", "SENT"),
      admin.from("provider_invoices").select("id", { count: "exact", head: true }).eq("status", "PAID"),
      admin.from("provider_invoices").select("id", { count: "exact", head: true }).eq("status", "DRAFT"),
      admin.from("webhook_events").select("id", { count: "exact", head: true }).eq("status", "FAILED"),
    ]);

  return {
    activeProviders: providersRes.count ?? 0,
    tripletexMappedProviders: mappedRes.count ?? 0,
    outboxPending: outboxPendingRes.count ?? 0,
    outboxFailed: outboxFailedRes.count ?? 0,
    invoicesSent: invSent.count ?? 0,
    invoicesPaid: invPaid.count ?? 0,
    invoicesDraft: invDraft.count ?? 0,
    webhooksFailed: whFailed.count ?? 0,
  };
}

export async function listWebhookEvents(opts: {
  status?: string;
  eventType?: string;
  limit?: number;
}): Promise<WebhookEventRow[]> {
  const admin = supabaseAdmin();
  const limit = Math.max(1, Math.min(200, opts.limit ?? 50));

  let q = admin
    .from("webhook_events")
    .select("id, event_id, event_type, status, received_at, processed_at, error_detail")
    .eq("source", "tripletex")
    .order("received_at", { ascending: false })
    .limit(limit);

  const status = safeStr(opts.status);
  if (status && status !== "ALL") q = q.eq("status", status);

  const eventType = safeStr(opts.eventType);
  if (eventType) q = q.eq("event_type", eventType);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (Array.isArray(data) ? data : []).map((row) => ({
    id: safeStr((row as { id?: unknown }).id),
    event_id: safeStr((row as { event_id?: unknown }).event_id),
    event_type: safeStr((row as { event_type?: unknown }).event_type),
    status: safeStr((row as { status?: unknown }).status),
    received_at: safeStr((row as { received_at?: unknown }).received_at),
    processed_at: safeStr((row as { processed_at?: unknown }).processed_at) || null,
    error_detail: safeStr((row as { error_detail?: unknown }).error_detail) || null,
  }));
}

export async function listTripletexOutbox(opts: {
  status?: string;
  limit?: number;
}): Promise<TripletexOutboxRow[]> {
  const admin = supabaseAdmin();
  const limit = Math.max(1, Math.min(200, opts.limit ?? 50));

  let q = admin
    .from("outbox")
    .select("id, event_key, status, attempts, last_error, created_at, next_retry_at")
    .like("event_key", "tripletex.%")
    .order("created_at", { ascending: false })
    .limit(limit);

  const status = safeStr(opts.status);
  if (status && status !== "ALL") {
    if (status === "FAILED") q = q.in("status", ["FAILED", "FAILED_PERMANENT"]);
    else q = q.eq("status", status);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (Array.isArray(data) ? data : []).map((row) => ({
    id: safeStr((row as { id?: unknown }).id),
    event_key: safeStr((row as { event_key?: unknown }).event_key),
    status: safeStr((row as { status?: unknown }).status),
    attempts: Number((row as { attempts?: unknown }).attempts ?? 0),
    last_error: safeStr((row as { last_error?: unknown }).last_error) || null,
    created_at: safeStr((row as { created_at?: unknown }).created_at),
    next_retry_at: safeStr((row as { next_retry_at?: unknown }).next_retry_at) || null,
  }));
}

function monthStartIso(monthsAgo: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() - monthsAgo);
  return d.toISOString().slice(0, 10);
}

export async function listProviderInvoices(opts: {
  status?: string;
  periodFrom?: string;
  limit?: number;
}): Promise<ProviderInvoiceRow[]> {
  const admin = supabaseAdmin();
  const limit = Math.max(1, Math.min(200, opts.limit ?? 50));
  const periodFrom = safeStr(opts.periodFrom) || monthStartIso(2);

  let q = admin
    .from("provider_invoices")
    .select(
      "id, invoice_number, provider_id, invoice_period, amount_total, status, tripletex_invoice_id, providers(name)",
    )
    .gte("invoice_period", periodFrom)
    .order("invoice_period", { ascending: false })
    .limit(limit);

  const status = safeStr(opts.status);
  if (status && status !== "ALL") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = Array.isArray(data) ? data : [];
  const refs = rows.map((r) => `lp_saas:${safeStr((r as { id?: unknown }).id)}`);

  const exportMap = new Map<string, string>();
  if (refs.length > 0) {
    const { data: exports } = await admin
      .from("tripletex_exports")
      .select("unique_ref, tripletex_invoice_id")
      .in("unique_ref", refs);
    for (const ex of exports ?? []) {
      exportMap.set(safeStr((ex as { unique_ref?: unknown }).unique_ref), safeStr((ex as { tripletex_invoice_id?: unknown }).tripletex_invoice_id));
    }
  }

  return rows.map((row) => {
    const id = safeStr((row as { id?: unknown }).id);
    const providers = (row as { providers?: { name?: unknown } | null }).providers;
    return {
      id,
      invoice_number: safeStr((row as { invoice_number?: unknown }).invoice_number) || null,
      provider_id: safeStr((row as { provider_id?: unknown }).provider_id),
      provider_name: safeStr(providers?.name) || "—",
      invoice_period: safeStr((row as { invoice_period?: unknown }).invoice_period),
      amount_total: Number((row as { amount_total?: unknown }).amount_total ?? 0),
      status: safeStr((row as { status?: unknown }).status),
      tripletex_invoice_id: safeStr((row as { tripletex_invoice_id?: unknown }).tripletex_invoice_id) || null,
      unique_ref: exportMap.get(`lp_saas:${id}`) ? `lp_saas:${id}` : null,
    };
  });
}

export async function listProviderTripletexSync(limit = 50): Promise<ProviderTripletexSyncRow[]> {
  const admin = supabaseAdmin();

  const { data: providers, error: pErr } = await admin
    .from("providers")
    .select("id, name, slug")
    .order("name", { ascending: true })
    .limit(limit);

  if (pErr) throw new Error(pErr.message);

  const list = Array.isArray(providers) ? providers : [];
  const ids = list.map((p) => safeStr((p as { id?: unknown }).id)).filter(Boolean);

  const mapByProvider = new Map<string, string>();
  if (ids.length > 0) {
    const { data: maps } = await admin
      .from("tripletex_customers")
      .select("provider_id, tripletex_customer_id")
      .in("provider_id", ids);
    for (const m of maps ?? []) {
      const pid = safeStr((m as { provider_id?: unknown }).provider_id);
      if (pid) mapByProvider.set(pid, safeStr((m as { tripletex_customer_id?: unknown }).tripletex_customer_id));
    }
  }

  return list.map((p) => {
    const providerId = safeStr((p as { id?: unknown }).id);
    const customerId = mapByProvider.get(providerId) || null;
    return {
      provider_id: providerId,
      provider_name: safeStr((p as { name?: unknown }).name),
      provider_slug: safeStr((p as { slug?: unknown }).slug),
      tripletex_customer_id: customerId,
      has_mapping: Boolean(customerId),
    };
  });
}

export function tripletexInvoiceUrl(tripletexInvoiceId: string | null): string | null {
  const id = safeStr(tripletexInvoiceId);
  if (!id) return null;
  const base = (safeStr(process.env.TRIPLETEX_BASE_URL) || "https://tripletex.no/v2").replace(/\/+$/, "");
  const appBase = base.replace(/\/v2$/i, "");
  return `${appBase}/execute/invoice?invoiceId=${encodeURIComponent(id)}`;
}
