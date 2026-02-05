// app/api/admin/esg/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

/* =========================================================
   Date helpers (Oslo month boundaries)
========================================================= */

function isoMonthStart(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = fmt.format(d); // YYYY-MM-DD
  return today.slice(0, 8) + "01"; // YYYY-MM-01
}

function addMonths(isoMonth01: string, delta: number) {
  const [y, m] = isoMonth01.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}-01`;
}

export async function GET(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();

  // 1) Scope
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;
  const ctx = a.ctx;

  // 2) Role gate (admin-side ESG: company_admin)
  const b = requireRoleOr403(ctx, ["company_admin"]);
  if (b instanceof Response) return b;

  // 3) Company scope gate
  const c = requireCompanyScopeOr403(ctx);
  if (c instanceof Response) return c;

  const companyId = String(ctx.scope.companyId);

  // 4) Last 12 months incl current
  const thisMonth = isoMonthStart(); // YYYY-MM-01
  const fromMonth = addMonths(thisMonth, -11);
  const year = Number(thisMonth.slice(0, 4));

  const { data: months, error: mErr } = await supabase
    .from("esg_monthly_snapshots")
    .select(
      "month, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score"
    )
    .eq("company_id", companyId)
    .gte("month", fromMonth)
    .lte("month", thisMonth)
    .order("month", { ascending: true });

  if (mErr) {
    return jsonErr(ctx.rid, "Kunne ikke hente månedssnapshots.", 500, { code: "db_error", detail: { message: mErr.message } });
  }

  const { data: yearly, error: yErr } = await supabase
    .from("esg_yearly_snapshots")
    .select(
      "year, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score"
    )
    .eq("company_id", companyId)
    .eq("year", year)
    .maybeSingle();

  if (yErr) {
    return jsonErr(ctx.rid, "Kunne ikke hente årssnapshot.", 500, { code: "db_error", detail: { message: yErr.message } });
  }

  return jsonOk(ctx.rid, { companyId, year, months: months ?? [], yearly: yearly ?? null }, 200);
}
