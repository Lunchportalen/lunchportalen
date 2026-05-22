
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

type InvoiceDbRow = {
  id: string;
  run_id: string | null;
  status: string;
  subtotal_nok: number | null;
  vat_nok: number | null;
  total_nok: number | null;
  created_at: string;
  invoice_runs?: { period_start: string; period_end: string } | { period_start: string; period_end: string }[] | null;
};

function periodFromJoin(row: InvoiceDbRow): { period_start: string; period_end: string } {
  const r = row.invoice_runs;
  if (!r) return { period_start: "", period_end: "" };
  const run = Array.isArray(r) ? r[0] : r;
  return {
    period_start: String(run?.period_start ?? ""),
    period_end: String(run?.period_end ?? ""),
  };
}

export async function GET(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const g = await scopeOr401(req);
  if (g instanceof Response) return g;

  const deny = requireRoleOr403(g.ctx, "api.superadmin.companies.invoices.GET", ["superadmin"]);
  if (deny instanceof Response) return deny;

  const url = new URL(req.url);
  const companyId = safeStr(url.searchParams.get("companyId"));
  if (!companyId) return jsonErr(g.ctx.rid, "Mangler companyId.", 400, "BAD_INPUT");

  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("invoices")
    .select("id, run_id, status, subtotal_nok, vat_nok, total_nok, created_at, invoice_runs(period_start, period_end)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonErr(g.ctx.rid, "Kunne ikke hente fakturaer.", 500, { code: "DB_ERROR", detail: error });
  }

  const invoices = (Array.isArray(data) ? data : []).map((row) => {
    const r = row as InvoiceDbRow;
    const period = periodFromJoin(r);
    return {
      id: r.id,
      period_start: period.period_start,
      period_end: period.period_end,
      status: r.status,
      amount_ex_vat: Number(r.subtotal_nok ?? 0),
      amount_inc_vat: Number(r.total_nok ?? 0),
      created_at: r.created_at,
    };
  });

  return jsonOk(g.ctx.rid, {
    ok: true,
    invoices,
  });
}
