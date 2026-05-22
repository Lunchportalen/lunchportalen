export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const revalidate = 0;

import { isMissingRelationError } from "@/lib/db/missingRelation";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import {
  INVOICE_LINE_RUN_SELECT,
  INVOICE_RUN_DETAIL_SELECT,
  type InvoiceLineDbRow,
  loadBillingTaxRates,
  mapInvoiceLineRow,
  mapInvoiceRunRow,
} from "@/lib/superadmin/invoiceRunDb";

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

async function adminDb(): Promise<any> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = supabaseAdmin as any;
  return typeof s === "function" ? await s() : s;
}

async function requireSuperadmin() {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, status: 401, message: "Ikke innlogget" };

  const role = String(data.user.user_metadata?.role ?? "");
  if (role !== "superadmin") return { ok: false as const, status: 403, message: "Ingen tilgang" };

  return { ok: true as const, userId: data.user.id };
}

export async function GET(_: Request, ctx: { params: { runId: string } }) {
  const rid = makeRid();
  const guard = await requireSuperadmin();
  if (!guard.ok) return jsonErr(rid, guard.message, guard.status ?? 400, "AUTH");

  const runId = ctx.params.runId;
  if (!isUuid(runId)) return jsonErr(rid, "Ugyldig runId", 400, "BAD_REQUEST");

  const db = await adminDb();
  if (!db?.from) return jsonErr(rid, "supabaseAdmin er ikke tilgjengelig (mangler .from)", 500, "ADMIN_CLIENT_MISSING");

  const runRes = await db.from("invoice_runs").select(INVOICE_RUN_DETAIL_SELECT).eq("id", runId).single();

  if (runRes.error) return jsonErr(rid, "Fant ikke invoice run", 404, { code: "NOT_FOUND", detail: runRes.error });

  const linesRes = await db.from("invoice_lines").select(INVOICE_LINE_RUN_SELECT).eq("run_id", runId);

  if (linesRes.error) return jsonErr(rid, "Kunne ikke hente invoice lines", 500, { code: "DB", detail: linesRes.error });

  const rawLines = (linesRes.data ?? []) as InvoiceLineDbRow[];

  if (!rawLines.length) {
    return jsonOk(rid, {
      run: mapInvoiceRunRow(runRes.data),
      rows: [],
      totals: { companies: 0, billable: 0, amount: 0, missingCustomer: 0, missingPrice: 0 },
      tripletex_mapping_available: true,
      billing_mapping: null,
    });
  }

  rawLines.sort((a, b) => {
    const an = (Array.isArray(a.companies) ? a.companies[0]?.name : a.companies?.name) ?? "";
    const bn = (Array.isArray(b.companies) ? b.companies[0]?.name : b.companies?.name) ?? "";
    return String(an).localeCompare(String(bn), "nb");
  });

  const companyIds = Array.from(new Set(rawLines.map((l) => l.company_id)));

  let tripletex_mapping_available = true;
  let billing_mapping: Record<string, unknown> | null = null;

  const mapRes = await db
    .from("company_billing_accounts")
    .select("company_id, tripletex_customer_id, product_name, vat_code")
    .in("company_id", companyIds);

  const map = new Map<string, any>();

  if (mapRes.error) {
    if (isMissingRelationError(mapRes.error, "company_billing_accounts")) {
      tripletex_mapping_available = false;
      billing_mapping = null;
    } else {
      return jsonErr(rid, "Kunne ikke hente billing mapping", 500, { code: "DB", detail: mapRes.error });
    }
  } else {
    for (const m of mapRes.data ?? []) map.set(m.company_id, m);
    billing_mapping = Object.fromEntries(map);
  }

  const vatRateById = await loadBillingTaxRates(db);

  const rows = rawLines.map((l) => {
    const m = map.get(l.company_id) ?? null;
    const dto = mapInvoiceLineRow(l, { vatRateById, vatCode: m?.vat_code ?? null });
    const export_status = !m?.tripletex_customer_id
      ? "MISSING_CUSTOMER_ID"
      : dto.price_ex_vat == null
        ? "MISSING_PRICE"
        : "OK";

    return {
      ...dto,
      tripletex_customer_id: m?.tripletex_customer_id ?? null,
      product_name: m?.product_name ?? null,
      vat_code: m?.vat_code ?? null,
      export_status,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.companies += 1;
      acc.billable += Number(r.billable_qty ?? 0);
      acc.amount += Number(r.amount_ex_vat ?? 0);
      acc.missingCustomer += r.export_status === "MISSING_CUSTOMER_ID" ? 1 : 0;
      acc.missingPrice += String(r.export_status ?? "").includes("MISSING_PRICE") ? 1 : 0;
      return acc;
    },
    { companies: 0, billable: 0, amount: 0, missingCustomer: 0, missingPrice: 0 },
  );

  return jsonOk(rid, {
    run: mapInvoiceRunRow(runRes.data),
    rows,
    totals,
    tripletex_mapping_available,
    billing_mapping,
  });
}
