import "server-only";

import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
import { createTripletexInvoice } from "@/lib/integrations/tripletexEngine";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BILLABLE_ORDER_STATUSES = ["ACTIVE"] as const;
const PAGE_SIZE = 1000;

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTier(value: unknown): "BASIS" | "LUXUS" | null {
  const tier = safeStr(value).toUpperCase();
  if (tier === "BASIS" || tier === "LUXUS") return tier;
  return null;
}

/** Siste 14 dager i Oslo: [start, today) på ISO-kalenderdager (samme mønster som måneds-cron: lt endExclusive). */
export function biweeklyInvoiceWindowFromToday(): { periodStart: string; periodEndExclusive: string } {
  const endExclusive = osloTodayISODate();
  const periodStart = addDaysISO(endExclusive, -14);
  return { periodStart, periodEndExclusive: endExclusive };
}

async function countBillableOrdersForCompany(
  admin: ReturnType<typeof supabaseAdmin>,
  companyId: string,
  periodStart: string,
  periodEndExclusive: string,
): Promise<number> {
  let total = 0;
  let offset = 0;
  while (true) {
    const { data, error } = await admin
      .from("orders")
      .select("company_id")
      .eq("company_id", companyId)
      .in("status", [...BILLABLE_ORDER_STATUSES])
      .gte("date", periodStart)
      .lt("date", periodEndExclusive)
      .order("date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    total += rows.length;
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return total;
}

async function loadLatestActiveAgreement(admin: ReturnType<typeof supabaseAdmin>, companyId: string) {
  const { data, error } = await admin
    .from("agreements")
    .select("company_id,tier,price_per_employee,updated_at")
    .eq("company_id", companyId)
    .eq("status", "ACTIVE")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { error: safeStr(error.message) };
  return { agreement: data };
}

export type GenerateCompanyInvoiceResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  total?: number;
  count?: number;
  invoiceId?: string;
  uniqueRef?: string;
};

/**
 * 14-dagers vindu: teller ACTIVE-ordrer × aktiv avtale pris (samme prinsipp som månedlig fakturagrunnlag).
 * Tripletex-oppfølging er valgfri via BIWEEKLY_TRIPLETEX_DIRECT_INVOICE_ENABLED (ellers kun logg — månedlig outbox forblir autoritativ).
 */
export async function generateCompanyInvoice(
  companyId: string,
  ctx: { rid: string },
  window = biweeklyInvoiceWindowFromToday(),
): Promise<GenerateCompanyInvoiceResult> {
  const cid = safeStr(companyId);
  if (!cid) {
    return { ok: false, skipped: true, reason: "missing_company_id" };
  }

  const admin = supabaseAdmin();
  let count = 0;
  try {
    count = await countBillableOrdersForCompany(admin, cid, window.periodStart, window.periodEndExclusive);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    opsLog("invoice_biweekly_count_failed", { rid: ctx.rid, companyId: cid, message: msg });
    return { ok: false, skipped: true, reason: "order_query_failed" };
  }

  if (count <= 0) {
    opsLog("invoice_generated", {
      rid: ctx.rid,
      companyId: cid,
      skipped: true,
      reason: "no_billable_orders",
      window,
    });
    return { ok: true, skipped: true, reason: "no_billable_orders", count: 0, total: 0 };
  }

  const { agreement, error: agrErr } = await loadLatestActiveAgreement(admin, cid);
  if (agrErr) {
    opsLog("invoice_generated", { rid: ctx.rid, companyId: cid, skipped: true, reason: agrErr });
    return { ok: true, skipped: true, reason: "agreement_load_failed", count };
  }

  const tier = normalizeTier((agreement as { tier?: unknown })?.tier);
  const pricePerEmployee = safeNum((agreement as { price_per_employee?: unknown })?.price_per_employee);
  if (!tier || !(pricePerEmployee > 0)) {
    opsLog("invoice_generated", {
      rid: ctx.rid,
      companyId: cid,
      skipped: true,
      reason: "missing_tier_or_price",
      count,
    });
    return { ok: true, skipped: true, reason: "missing_tier_or_price", count };
  }

  const total = Number((count * pricePerEmployee).toFixed(4));

  const uniqueRef = `lp_bw:${cid}:${window.periodStart}:${window.periodEndExclusive}`;

  const directEnabled = safeStr(process.env.BIWEEKLY_TRIPLETEX_DIRECT_INVOICE_ENABLED).toLowerCase() === "true";
  if (!directEnabled) {
    opsLog("invoice_generated", {
      rid: ctx.rid,
      companyId: cid,
      total,
      count,
      uniqueRef,
      window,
      tripletex: "skipped_policy_monthly_outbox_authoritative",
    });
    return { ok: true, skipped: true, reason: "biweekly_tripletex_disabled", count, total, uniqueRef };
  }

  const { data: existing } = await admin.from("tripletex_exports").select("tripletex_invoice_id").eq("unique_ref", uniqueRef).maybeSingle();
  if (safeStr((existing as { tripletex_invoice_id?: unknown })?.tripletex_invoice_id)) {
    opsLog("invoice_generated", {
      rid: ctx.rid,
      companyId: cid,
      skipped: true,
      reason: "already_exported",
      uniqueRef,
    });
    return {
      ok: true,
      skipped: true,
      reason: "already_exported",
      count,
      total,
      uniqueRef,
      invoiceId: safeStr((existing as { tripletex_invoice_id?: unknown })?.tripletex_invoice_id),
    };
  }

  const { data: custRow } = await admin
    .from("tripletex_customers")
    .select("tripletex_customer_id")
    .eq("company_id", cid)
    .maybeSingle();
  const tripletexCustomerId = safeStr((custRow as { tripletex_customer_id?: unknown })?.tripletex_customer_id);

  const { data: prodRow } = await admin
    .from("billing_products")
    .select("tripletex_product_id, tax_code_id, product_name")
    .eq("tier", tier)
    .maybeSingle();
  const productId = safeStr((prodRow as { tripletex_product_id?: unknown })?.tripletex_product_id);
  const productName = safeStr((prodRow as { product_name?: unknown })?.product_name) || "Firmalunsj";
  const taxCodeId = safeStr((prodRow as { tax_code_id?: unknown })?.tax_code_id);

  let vatCode: string | null = null;
  if (taxCodeId) {
    const { data: tax } = await admin.from("billing_tax_codes").select("tripletex_vat_code").eq("id", taxCodeId).maybeSingle();
    vatCode = safeStr((tax as { tripletex_vat_code?: unknown })?.tripletex_vat_code) || null;
  }

  const invoice = await createTripletexInvoice(
    {
      amount: total,
      description: `Firmalunsj – 14 dagers faktura (${window.periodStart}–${window.periodEndExclusive})`,
      uniqueRef,
      customerId: tripletexCustomerId || undefined,
      productId: productId || undefined,
      tripletex_vat_code: vatCode || undefined,
    },
    { rid: ctx.rid },
  );

  opsLog("invoice_generated", {
    rid: ctx.rid,
    companyId: cid,
    total,
    count,
    uniqueRef,
    invoiceOk: invoice.ok,
    invoiceId: invoice.invoiceId,
    skipped: invoice.skipped,
    reason: invoice.reason,
  });

  if (invoice.ok && invoice.invoiceId) {
    await admin.from("tripletex_exports").upsert(
      {
        unique_ref: uniqueRef,
        tripletex_invoice_id: invoice.invoiceId,
      },
      { onConflict: "unique_ref" },
    );
  }

  return {
    ok: invoice.ok,
    skipped: invoice.skipped,
    reason: invoice.reason,
    total,
    count,
    invoiceId: invoice.invoiceId,
    uniqueRef,
  };
}
