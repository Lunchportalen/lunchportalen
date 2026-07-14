// lib/billing/invoiceLifecycle.ts
//
// FASE 8 — service-lag for provider→company invoice-only fakturering.
// All forretningslogikk bor i RPC-ene (lp_invoice_*, service_role only);
// dette laget er tynne, provider-/company-scopede vrappere. INGEN Stripe.
import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export const INVOICE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CREDITED",
  "VOID",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type InvoiceHead = {
  id: string;
  kind: "INVOICE" | "CREDIT_NOTE";
  status: string;
  invoice_number: string | null;
  provider_id: string;
  company_id: string;
  location_id: string | null;
  invoice_period_start: string;
  invoice_period_end: string;
  currency: string;
  amount_net: number;
  amount_tax: number;
  amount_total: number;
  amount_paid: number;
  payment_terms_days: number;
  issued_at: string | null;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  recipient_email: string | null;
  credit_of_invoice_id: string | null;
  credited_by_invoice_id: string | null;
  created_at: string;
};

export type InvoiceLine = {
  id: string;
  source: string;
  product_key: string | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  line_amount: number;
  vat_rate: number;
  vat_amount: number;
  currency: string;
  order_id: string | null;
  location_id: string | null;
  service_date: string | null;
};

export type InvoicePayment = {
  id: string;
  amount: number;
  paid_at: string;
  method: string;
  reference: string | null;
  created_at: string;
};

const HEAD_FIELDS =
  "id, kind, status, invoice_number, provider_id, company_id, location_id, invoice_period_start, invoice_period_end, currency, amount_net, amount_tax, amount_total, amount_paid, payment_terms_days, issued_at, due_date, sent_at, paid_at, recipient_email, credit_of_invoice_id, credited_by_invoice_id, created_at";

function admin() {
  return supabaseAdmin() as any;
}

export async function listProviderInvoices(providerId: string): Promise<InvoiceHead[]> {
  const { data, error } = await admin()
    .from("agreement_invoices")
    .select(HEAD_FIELDS)
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`listProviderInvoices failed: ${error.message}`);
  return (data ?? []) as InvoiceHead[];
}

export async function listCompanyInvoices(companyId: string): Promise<InvoiceHead[]> {
  const { data, error } = await admin()
    .from("agreement_invoices")
    .select(HEAD_FIELDS)
    .eq("company_id", companyId)
    // Company ser kun utstedte dokumenter — aldri provider-utkast.
    .neq("status", "DRAFT")
    .neq("status", "VOID")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`listCompanyInvoices failed: ${error.message}`);
  return (data ?? []) as InvoiceHead[];
}

export async function loadInvoiceWithLines(invoiceId: string): Promise<{
  head: InvoiceHead;
  lines: InvoiceLine[];
  payments: InvoicePayment[];
  providerName: string;
  companyName: string;
} | null> {
  const a = admin();
  const { data: head, error } = await a.from("agreement_invoices").select(HEAD_FIELDS).eq("id", invoiceId).maybeSingle();
  if (error || !head) return null;

  const [linesRes, paymentsRes, providerRes, companyRes] = await Promise.all([
    a
      .from("agreement_invoice_lines")
      .select("id, source, product_key, description, quantity, unit_price, line_amount, vat_rate, vat_amount, currency, order_id, location_id, service_date")
      .eq("invoice_id", invoiceId)
      .order("service_date", { ascending: true })
      .order("created_at", { ascending: true }),
    a.from("invoice_payments").select("id, amount, paid_at, method, reference, created_at").eq("invoice_id", invoiceId).order("paid_at"),
    a.from("providers").select("name").eq("id", (head as any).provider_id).maybeSingle(),
    a.from("companies").select("name").eq("id", (head as any).company_id).maybeSingle(),
  ]);

  return {
    head: head as InvoiceHead,
    lines: (linesRes.data ?? []) as InvoiceLine[],
    payments: (paymentsRes.data ?? []) as InvoicePayment[],
    providerName: String(providerRes.data?.name ?? ""),
    companyName: String(companyRes.data?.name ?? ""),
  };
}

type RpcResult = { data: unknown; error: { message?: string } | null };

function mapRpcError(error: { message?: string } | null): string | null {
  if (!error) return null;
  const m = String(error.message ?? "").toUpperCase();
  const known = [
    "PERIOD_INVALID",
    "COMPANY_NOT_OWNED_BY_PROVIDER",
    "AGREEMENT_NOT_FOUND",
    "PERIOD_ALREADY_INVOICED",
    "NO_CHARGEABLE_ORDERS",
    "CURRENCY_MIXED",
    "INVOICE_NOT_FOUND",
    "INVOICE_NOT_DRAFT",
    "INVOICE_HAS_NO_LINES",
    "INVOICE_NOT_ISSUED",
    "INVOICE_NOT_PAYABLE",
    "INVOICE_NOT_CREDITABLE",
    "INVOICE_NOT_VOIDABLE",
    "NO_LINES_TO_CREDIT",
    "PAYMENT_AMOUNT_INVALID",
    "IDEMPOTENCY_KEY_REQUIRED",
    "REASON_REQUIRED",
    "LINE_SOURCE_INVALID",
    "ADDITION_MUST_BE_POSITIVE",
    "DESCRIPTION_REQUIRED",
    "LINE_VALUES_INVALID",
    "NOT_AN_INVOICE",
  ];
  for (const k of known) if (m.includes(k)) return k;
  return "INVOICE_RPC_FAILED";
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<{ ok: true; data: any } | { ok: false; code: string }> {
  const { data, error }: RpcResult = await admin().rpc(fn, args);
  const code = mapRpcError(error);
  if (code) return { ok: false, code };
  return { ok: true, data };
}

export const invoiceRpc = {
  buildDraft: (p: { providerId: string; companyId: string; periodStart: string; periodEnd: string; actor: string | null }) =>
    rpc("lp_invoice_build_draft", {
      p_provider_id: p.providerId,
      p_company_id: p.companyId,
      p_period_start: p.periodStart,
      p_period_end: p.periodEnd,
      p_actor_user_id: p.actor,
    }),
  addLine: (p: {
    invoiceId: string;
    source: string;
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    actor: string | null;
    orderId?: string | null;
    serviceDate?: string | null;
  }) =>
    rpc("lp_invoice_add_line", {
      p_invoice_id: p.invoiceId,
      p_source: p.source,
      p_description: p.description,
      p_quantity: p.quantity,
      p_unit_price: p.unitPrice,
      p_vat_rate: p.vatRate,
      p_actor_user_id: p.actor,
      p_order_id: p.orderId ?? null,
      p_service_date: p.serviceDate ?? null,
    }),
  finalize: (p: { invoiceId: string; actor: string | null }) =>
    rpc("lp_invoice_finalize", { p_invoice_id: p.invoiceId, p_actor_user_id: p.actor }),
  markSent: (p: { invoiceId: string; recipient: string; actor: string | null }) =>
    rpc("lp_invoice_mark_sent", { p_invoice_id: p.invoiceId, p_recipient_email: p.recipient, p_actor_user_id: p.actor }),
  registerPayment: (p: {
    invoiceId: string;
    amount: number;
    paidAt: string | null;
    method: string | null;
    reference: string | null;
    idempotencyKey: string;
    actor: string | null;
  }) =>
    rpc("lp_invoice_register_payment", {
      p_invoice_id: p.invoiceId,
      p_amount: p.amount,
      p_paid_at: p.paidAt,
      p_method: p.method,
      p_reference: p.reference,
      p_idempotency_key: p.idempotencyKey,
      p_actor_user_id: p.actor,
    }),
  refreshOverdue: (providerId: string | null) => rpc("lp_invoice_refresh_overdue", { p_provider_id: providerId }),
  createCreditNote: (p: { invoiceId: string; reason: string; actor: string | null; orderIds?: string[] | null }) =>
    rpc("lp_invoice_create_credit_note", {
      p_invoice_id: p.invoiceId,
      p_reason: p.reason,
      p_actor_user_id: p.actor,
      p_order_ids: p.orderIds ?? null,
    }),
  void: (p: { invoiceId: string; reason: string; actor: string | null }) =>
    rpc("lp_invoice_void", { p_invoice_id: p.invoiceId, p_reason: p.reason, p_actor_user_id: p.actor }),
};

/** Sender fakturaen på e-post (idempotent outbox) og markerer SENT. Fail-closed uten fakturamottaker. */
export async function sendInvoiceEmail(p: {
  invoiceId: string;
  actor: string | null;
  baseUrl: string;
}): Promise<{ ok: true; recipient: string } | { ok: false; code: string }> {
  const bundle = await loadInvoiceWithLines(p.invoiceId);
  if (!bundle) return { ok: false, code: "INVOICE_NOT_FOUND" };
  const { head, companyName, providerName } = bundle;
  if (head.status !== "ISSUED" && head.status !== "SENT") return { ok: false, code: "INVOICE_NOT_ISSUED" };

  const a = admin();
  const { data: company } = await a.from("companies").select("billing_email, contact_email").eq("id", head.company_id).maybeSingle();
  const recipient = String(company?.billing_email ?? "").trim().toLowerCase() || String(company?.contact_email ?? "").trim().toLowerCase();
  if (!recipient) return { ok: false, code: "BILLING_EMAIL_MISSING" };

  const kindLabel = head.kind === "CREDIT_NOTE" ? "Kreditnota" : "Faktura";
  const nf = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dueLine = head.due_date && head.kind === "INVOICE" ? `\nForfallsdato: ${head.due_date}` : "";
  const link = `${p.baseUrl.replace(/\/$/, "")}/admin/fakturaer/${head.id}`;
  const eventKey = `invoice.email:${head.id}`;

  const { error: outboxErr } = await a.from("outbox").upsert(
    {
      event_key: eventKey,
      payload: {
        event: "invoice.email",
        type: "invoice.email",
        from: "Lunchportalen <no-reply@lunchportalen.no>",
        to: recipient,
        subject: `${kindLabel} ${head.invoice_number ?? ""} fra ${providerName} – Lunchportalen`,
        bodyText: `Hei,\n\n${kindLabel} ${head.invoice_number ?? ""} fra ${providerName} til ${companyName}.\n\nPeriode: ${head.invoice_period_start} – ${head.invoice_period_end}\nBeløp: ${nf.format(head.amount_total)} ${head.currency}${dueLine}\n\nSe fakturaen: ${link}\n\nBetaling skjer via bankoverføring (ingen kortbetaling).\n\nMed vennlig hilsen\nLunchportalen på vegne av ${providerName}`,
        invoice_id: head.id,
        invoice_number: head.invoice_number,
      },
      status: "PENDING",
      attempts: 0,
    },
    { onConflict: "event_key" },
  );
  if (outboxErr) return { ok: false, code: "EMAIL_ENQUEUE_FAILED" };

  const marked = await invoiceRpc.markSent({ invoiceId: p.invoiceId, recipient, actor: p.actor });
  if (marked.ok === false) return { ok: false, code: marked.code };
  return { ok: true, recipient };
}

/** Standard CSV-eksport (regnskapsgrunnlag) for markeder uten adapter. */
export function invoicesToAccountingCsv(rows: Array<{ head: InvoiceHead; lines: InvoiceLine[]; companyName: string }>): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const out: string[] = [
    [
      "invoice_number",
      "kind",
      "status",
      "company",
      "period_start",
      "period_end",
      "issued_at",
      "due_date",
      "currency",
      "line_source",
      "description",
      "quantity",
      "unit_price",
      "net",
      "tax_rate",
      "tax_amount",
      "gross",
    ].join(";"),
  ];
  for (const r of rows) {
    for (const l of r.lines) {
      out.push(
        [
          esc(r.head.invoice_number ?? r.head.id),
          r.head.kind,
          r.head.status,
          esc(r.companyName),
          r.head.invoice_period_start,
          r.head.invoice_period_end,
          esc(r.head.issued_at ?? ""),
          esc(r.head.due_date ?? ""),
          r.head.currency,
          l.source,
          esc(l.description ?? ""),
          String(l.quantity),
          l.unit_price.toFixed(2),
          l.line_amount.toFixed(2),
          l.vat_rate.toFixed(4),
          l.vat_amount.toFixed(2),
          (l.line_amount + l.vat_amount).toFixed(2),
        ].join(";"),
      );
    }
  }
  return `\ufeff${out.join("\n")}\n`;
}
