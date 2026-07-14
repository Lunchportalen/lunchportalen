// FASE 8 — regnskapseksport (kravpunkt 21–23): adapteroppslag per marked.
// Tripletex KUN for Norge (enqueue via eksisterende outbox-sti); alle andre
// markeder får standard CSV. Aldri Stripe, aldri Tripletex som global default.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { requireProviderForInvoices } from "@/lib/billing/providerInvoiceGuard";
import { listProviderInvoices, loadInvoiceWithLines, invoicesToAccountingCsv } from "@/lib/billing/invoiceLifecycle";
import { resolveAccountingAdapter } from "@/lib/accounting/registry";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const rid = makeRid("prov_inv_export");
  const g = await requireProviderForInvoices({ minRole: "provider_viewer" });
  if (g.ok === false) return jsonErr(rid, g.message, g.status, g.code);

  const url = new URL(req.url);
  const from = String(url.searchParams.get("from") ?? "").trim();
  const to = String(url.searchParams.get("to") ?? "").trim();

  // Providerens marked avgjør adapter (default_country_code, fail-closed → CSV).
  const admin = supabaseAdmin() as any;
  const { data: settings } = await admin
    .from("provider_settings")
    .select("default_country_code")
    .eq("provider_id", g.providerId)
    .maybeSingle();
  const country = String(settings?.default_country_code ?? "").trim().toUpperCase();
  const adapter = resolveAccountingAdapter(country);

  const heads = (await listProviderInvoices(g.providerId)).filter(
    (h) =>
      h.status !== "DRAFT" &&
      h.status !== "VOID" &&
      (!from || h.invoice_period_start >= from) &&
      (!to || h.invoice_period_end <= to),
  );

  const bundles = [];
  for (const head of heads) {
    const b = await loadInvoiceWithLines(head.id);
    if (b) bundles.push({ head: b.head, lines: b.lines, companyName: b.companyName });
  }

  const csv = invoicesToAccountingCsv(bundles);
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="regnskapseksport-${g.providerId.slice(0, 8)}.csv"`,
      "cache-control": "no-store",
      "x-rid": rid,
      "x-accounting-adapter": adapter.name,
    },
  });
}
