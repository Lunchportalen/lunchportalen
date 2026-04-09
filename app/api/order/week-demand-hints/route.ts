// GET /api/order/week-demand-hints — additiv, kun signaler til ukevisning (ingen manipulasjon).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
import type { WeekdayKeyMonFri } from "@/lib/date/weekdayKeyFromIso";
import { weekdayKeyFromOsloISODate } from "@/lib/date/weekdayKeyFromIso";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { aggregateOrdersByDate, type OrderRowForDemand } from "@/lib/ai/demandData";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

const NB: Record<WeekdayKeyMonFri, string> = {
  mon: "mandag",
  tue: "tirsdag",
  wed: "onsdag",
  thu: "torsdag",
  fri: "fredag",
};

export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s = await scopeOr401(req);
  if (s.ok === false) return s.res;

  const { rid, scope } = s.ctx;
  const deny = requireRoleOr403(s.ctx, ["employee", "company_admin"]);
  if (deny) return deny;

  const companyId = safeStr(scope.companyId);
  const locationId = safeStr(scope.locationId);

  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const today = osloTodayISODate();
  const from = addDaysISO(today, -56);

  const admin = supabaseAdmin();
  let q = admin
    .from("orders")
    .select("date,status,created_at,updated_at")
    .eq("company_id", companyId)
    .gte("date", from)
    .lte("date", today);

  if (locationId) q = q.eq("location_id", locationId);

  const { data, error } = await q;
  if (error) {
    return jsonErr(rid, "Kunne ikke hente data.", 500, { code: "ORDERS_FETCH_FAILED", detail: error });
  }

  const map = aggregateOrdersByDate((data ?? []) as OrderRowForDemand[]);
  const sums: Record<WeekdayKeyMonFri, number> = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0 };
  const counts: Record<WeekdayKeyMonFri, number> = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0 };

  for (const h of map.values()) {
    const k = weekdayKeyFromOsloISODate(h.date);
    if (!k) continue;
    sums[k] += h.activeCount;
    counts[k] += 1;
  }

  const avgs = (["mon", "tue", "wed", "thu", "fri"] as const)
    .map((k) => ({
      weekday: k,
      label: NB[k],
      avg: counts[k] > 0 ? sums[k] / counts[k] : 0,
      days: counts[k],
    }))
    .filter((x) => x.days > 0)
    .sort((a, b) => b.avg - a.avg);

  const maxAvg = avgs[0]?.avg ?? 0;
  const highDemandWeekdays =
    maxAvg > 0 ? avgs.filter((x) => x.avg >= maxAvg * 0.92).map((x) => x.weekday) : [];
  const minAvg = avgs[avgs.length - 1]?.avg ?? 0;
  const weakDemandWeekdays =
    avgs.length > 1 && maxAvg > 0 && minAvg < maxAvg * 0.55
      ? avgs.filter((x) => x.avg <= minAvg * 1.08).map((x) => x.weekday)
      : [];

  return jsonOk(
    rid,
    {
      transparencyNote: "Basert på historiske bestillinger",
      highDemandWeekdays,
      weakDemandWeekdays,
      ranking: avgs,
      hint:
        avgs.length === 0
          ? null
          : `Mønster siste uker: høyest snitt på ${avgs[0]?.label ?? "—"}. Kun informasjon — ingen endring i dine valg.`,
    },
    200,
  );
  });
}
