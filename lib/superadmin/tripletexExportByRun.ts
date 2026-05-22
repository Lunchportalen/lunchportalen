import "server-only";

import { isMissingRelationError } from "@/lib/db/missingRelation";

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

type InvoiceLine = {
  company_id: string;
  company_name: string | null;
  plan_tier: string | null;
  price_ex_vat: number | null;
  billable_qty: number;
  amount_ex_vat: number | null;
  flags: string | null;
};

async function adminDb(): Promise<any> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = supabaseAdmin as any;
  return typeof s === "function" ? await s() : s;
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

  const runRes = await db
    .from("invoice_runs")
    .select("id, period_from, period_to")
    .eq("id", runId)
    .single();

  if (runRes.error) {
    return { ok: false, code: "NOT_FOUND", message: "Fant ikke invoice run", detail: runRes.error };
  }

  const linesRes = await db
    .from("invoice_lines")
    .select("company_id, company_name, plan_tier, price_ex_vat, billable_qty, amount_ex_vat, flags")
    .eq("run_id", runId)
    .order("company_name", { ascending: true });

  if (linesRes.error) {
    return { ok: false, code: "DB", message: "Kunne ikke hente invoice lines", detail: linesRes.error };
  }

  const lines = (linesRes.data ?? []) as InvoiceLine[];
  if (!lines.length) return { ok: true, rows: [] };

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

  const period_from = String(runRes.data.period_from ?? "");
  const period_to = String(runRes.data.period_to ?? "");

  const rows: TripletexExportRow[] = lines.map((l) => {
    const m = map.get(l.company_id) ?? null;
    const status = !m?.tripletex_customer_id
      ? "MISSING_CUSTOMER_ID"
      : l.flags
        ? String(l.flags)
        : "OK";
    const product = m?.product_name ?? l.plan_tier ?? "Lunsj";
    return {
      run_id: runId,
      customer_id: m?.tripletex_customer_id ?? null,
      company_name: String(l.company_name ?? ""),
      description: String(product),
      period_from,
      period_to,
      quantity: Number(l.billable_qty ?? 0),
      unit_price_ex_vat: l.price_ex_vat ?? null,
      amount_ex_vat: l.amount_ex_vat ?? null,
      vat_code: m?.vat_code ?? null,
      status,
    };
  });

  return { ok: true, rows };
}
