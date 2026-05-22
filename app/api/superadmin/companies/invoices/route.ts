
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
};

type RunPeriodRow = {
  id: string;
  period_start: string;
  period_end: string;
};

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
    .select("id, run_id, status, subtotal_nok, vat_nok, total_nok, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonErr(g.ctx.rid, "Kunne ikke hente fakturaer.", 500, { code: "DB_ERROR", detail: error });
  }

  const rows = (Array.isArray(data) ? data : []) as InvoiceDbRow[];
  const runIds = Array.from(new Set(rows.map((r) => safeStr(r.run_id)).filter(Boolean)));

  const periodByRunId = new Map<string, { period_start: string; period_end: string }>();
  if (runIds.length) {
    const { data: runs, error: runErr } = await admin
      .from("invoice_runs")
      .select("id, period_start, period_end")
      .in("id", runIds);

    if (runErr) {
      return jsonErr(g.ctx.rid, "Kunne ikke hente fakturaperioder.", 500, { code: "DB_ERROR", detail: runErr });
    }

    for (const run of (Array.isArray(runs) ? runs : []) as RunPeriodRow[]) {
      periodByRunId.set(run.id, {
        period_start: String(run.period_start ?? ""),
        period_end: String(run.period_end ?? ""),
      });
    }
  }

  const invoices = rows.map((r) => {
    const period = r.run_id ? periodByRunId.get(r.run_id) : undefined;
    return {
      id: r.id,
      period_start: period?.period_start ?? "",
      period_end: period?.period_end ?? "",
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
