
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

function safeStr(v: any) {
  return String(v ?? "").trim();
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

  /**
   * Antatt invoices-tabell:
   * - id
   * - company_id
   * - period_start
   * - period_end
   * - status (draft|sent|paid|overdue)
   * - amount_ex_vat
   * - amount_inc_vat
   * - created_at
   */
  const { data, error } = await admin
    .from("invoices")
    .select(
      "id, period_start, period_end, status, amount_ex_vat, amount_inc_vat, created_at"
    )
    .eq("company_id", companyId)
    .order("period_start", { ascending: false });

  if (error) {
    return jsonErr(g.ctx.rid, "Kunne ikke hente fakturaer.", 500, { code: "DB_ERROR", detail: error });
  }

  return jsonOk(g.ctx.rid, {
    ok: true,
    invoices: data ?? [],
  });
}


