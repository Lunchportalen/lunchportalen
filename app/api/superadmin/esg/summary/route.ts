

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { getScope } from "@/lib/auth/scope";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

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
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = makeRid();

  const supabase = await supabaseServer();

  // ✅ robust scope (støtter både Scope og { ok:false })
  const scope: any = await getScope(req);
  if (scope?.ok === false) return jsonErr(rid, "Ikke innlogget", 401, { code: "UNAUTHORIZED", detail: scope });
  if (!scope?.role) return jsonErr(rid, "Ikke innlogget", 401, { code: "UNAUTHORIZED", detail: scope });

  if (scope.role !== "superadmin") {
    return jsonErr(rid, "Krever superadmin", 403, { code: "FORBIDDEN", detail: { role: scope.role ?? null } });
  }

  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return jsonErr(rid, "company_id mangler", 400, "BAD_REQUEST");

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

  if (mErr) return jsonErr(rid, "Kunne ikke hente månedssnapshots", 500, { code: "DB_ERROR", detail: mErr });

  const { data: yearly, error: yErr } = await supabase
    .from("esg_yearly_snapshots")
    .select(
      "year, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score"
    )
    .eq("company_id", companyId)
    .eq("year", year)
    .maybeSingle();

  if (yErr) return jsonErr(rid, "Kunne ikke hente årssnapshot", 500, { code: "DB_ERROR", detail: yErr });

  return jsonOk(rid, { company_id: companyId, year, months: months ?? [], yearly: yearly ?? null });
}


