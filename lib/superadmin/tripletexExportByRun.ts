import "server-only";

import { isMissingRelationError } from "@/lib/db/missingRelation";
import {
  INVOICE_LINE_EXPORT_SELECT,
  INVOICE_RUN_DETAIL_SELECT,
  type InvoiceLineDbRow,
  lineAmountExVat,
  lineUnitPriceExVat,
  loadBillingTaxRates,
  mapInvoiceRunRow,
} from "@/lib/superadmin/invoiceRunDb";

export type TripletexExportRow = {
  run_id: string;
  customer_id: string | null;
  company_name: string;
  description: string;
  period_from: string;
  period_to: string;
  quantity: number;
  unit_price_ex_vat: number | null;
  amount_ex_vat: number | null;
  vat_code: string | null;
  status: string;
};

async function adminDb(): Promise<any> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = supabaseAdmin as any;
  return typeof s === "function" ? await s() : s;
}

function companyNameFromJoin(row: InvoiceLineDbRow): string {
  const c = row.companies;
  if (!c) return "";
  if (Array.isArray(c)) return String(c[0]?.name ?? "");
  return String(c.name ?? "");
}

/**
 * Builds Tripletex CSV/JSON export rows from invoice_lines + billing mapping.
 * Replaces removed `tripletex_export_by_run` RPC (K4 Bølge 2C).
 */
export async function loadTripletexExportByRun(runId: string): Promise<
  | { ok: true; rows: TripletexExportRow[] }
  | { ok: false; code: string; message: string; detail?: unknown }
> {
  const db = await adminDb();
  if (!db?.from) {
    return { ok: false, code: "ADMIN_CLIENT_MISSING", message: "supabaseAdmin er ikke tilgjengelig" };
  }

  const runRes = await db.from("invoice_runs").select(INVOICE_RUN_DETAIL_SELECT).eq("id", runId).single();

  if (runRes.error) {
    return { ok: false, code: "NOT_FOUND", message: "Fant ikke invoice run", detail: runRes.error };
  }

  const linesRes = await db
    .from("invoice_lines")
    .select(INVOICE_LINE_EXPORT_SELECT)
    .eq("run_id", runId);

  if (linesRes.error) {
    return { ok: false, code: "DB", message: "Kunne ikke hente invoice lines", detail: linesRes.error };
  }

  const lines = (linesRes.data ?? []) as InvoiceLineDbRow[];
  if (!lines.length) return { ok: true, rows: [] };

  lines.sort((a, b) => companyNameFromJoin(a).localeCompare(companyNameFromJoin(b), "nb"));

  const companyIds = Array.from(new Set(lines.map((l) => l.company_id)));
  const map = new Map<string, { tripletex_customer_id?: string | null; product_name?: string | null; vat_code?: string | null }>();

  const mapRes = await db
    .from("company_billing_accounts")
    .select("company_id, tripletex_customer_id, product_name, vat_code")
    .in("company_id", companyIds);

  if (mapRes.error) {
    if (!isMissingRelationError(mapRes.error, "company_billing_accounts")) {
      return { ok: false, code: "DB", message: "Kunne ikke hente billing mapping", detail: mapRes.error };
    }
  } else {
    for (const m of mapRes.data ?? []) map.set(m.company_id, m);
  }

  const vatRateById = await loadBillingTaxRates(db);
  const runDto = mapInvoiceRunRow(runRes.data);

  const rows: TripletexExportRow[] = lines.map((l) => {
    const m = map.get(l.company_id) ?? null;
    const vatCode = m?.vat_code ?? null;
    const status = !m?.tripletex_customer_id ? "MISSING_CUSTOMER_ID" : "OK";
    const product = m?.product_name ?? l.tier ?? l.description ?? "Lunsj";
    return {
      run_id: runId,
      customer_id: m?.tripletex_customer_id ?? null,
      company_name: companyNameFromJoin(l),
      description: String(product),
      period_from: runDto.period_from,
      period_to: runDto.period_to,
      quantity: Math.max(0, Math.floor(Number(l.quantity ?? 0))),
      unit_price_ex_vat: lineUnitPriceExVat(l),
      amount_ex_vat: lineAmountExVat(l, vatRateById, vatCode),
      vat_code: vatCode,
      status,
    };
  });

  return { ok: true, rows };
}
