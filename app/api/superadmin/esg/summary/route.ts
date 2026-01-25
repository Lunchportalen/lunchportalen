export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getScope } from "@/lib/auth/scope";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

function isoMonthStart() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = fmt.format(new Date());
  return today.slice(0, 8) + "01";
}
function addMonths(isoMonth01: string, delta: number) {
  const [y, m] = isoMonth01.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function GET(req: NextRequest) {
  const rid = crypto.randomUUID?.() ?? String(Date.now());

  const supabase = await supabaseServer();

  // ✅ robust scope (støtter både Scope og { ok:false })
  const scope: any = await getScope(req);
  if (scope?.ok === false) return jsonErr(401, rid, "UNAUTHORIZED", "Ikke innlogget", scope);
  if (!scope?.role) return jsonErr(401, rid, "UNAUTHORIZED", "Ikke innlogget", scope);

  if (scope.role !== "superadmin") {
    return jsonErr(403, rid, "FORBIDDEN", "Krever superadmin", { role: scope.role ?? null });
  }

  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return jsonErr(400, rid, "BAD_REQUEST", "company_id mangler");

  const thisMonth = isoMonthStart();
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

  if (mErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente månedssnapshots", mErr);

  const { data: yearly, error: yErr } = await supabase
    .from("esg_yearly_snapshots")
    .select(
      "year, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score"
    )
    .eq("company_id", companyId)
    .eq("year", year)
    .maybeSingle();

  if (yErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente årssnapshot", yErr);

  return jsonOk({ ok: true, rid, company_id: companyId, year, months: months ?? [], yearly: yearly ?? null });
}
