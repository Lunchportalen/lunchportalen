// app/api/superadmin/dashboard/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { osloTodayISODate } from "@/lib/date/oslo";

type DashboardCounts = {
  companies: { active: number; pending: number; paused: number; closed: number; total: number };
  orders: { today: number; tomorrow: number; week: number };
  alerts: { pendingCompanies: number; pausedCompanies: number };
};

function asInt(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function startOfWeekISO(iso: string) {
  // Week = Mon–Sun
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0 Sun..6 Sat
  const diffToMon = (day + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - diffToMon);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const gate = await scopeOr401(req);

  // ✅ Hos dere: fail returnerer Response direkte
  if (gate instanceof Response) return gate;

  const { ctx } = gate;
  const rid = ctx.rid;

  const roleGate = requireRoleOr403(ctx, ["superadmin"]);

  // ✅ Hos dere: fail returnerer Response direkte
  if (roleGate instanceof Response) return roleGate;

  const sb = supabaseAdmin();

  try {
    const today = osloTodayISODate();
    const tomorrow = addDaysISO(today, 1);
    const weekStart = startOfWeekISO(today);
    const weekEndExclusive = addDaysISO(weekStart, 7);

    // Companies status counts (forutsetter companies.status = active|pending|paused|closed)
    const { data: companyRows, error: cErr } = await sb.from("companies").select("status");
    if (cErr) return jsonErr(500, rid, "DB_COMPANIES", "Kunne ikke lese firma-status.", cErr);

    const counts = { active: 0, pending: 0, paused: 0, closed: 0, total: 0 };
    for (const r of companyRows ?? []) {
      counts.total++;
      const st = String((r as any).status ?? "").toLowerCase();
      if (st === "active") counts.active++;
      else if (st === "pending") counts.pending++;
      else if (st === "paused") counts.paused++;
      else if (st === "closed") counts.closed++;
    }

    // Orders counts
    const [
      { count: todayCount, error: o1Err },
      { count: tomorrowCount, error: o2Err },
      { count: weekCount, error: o3Err },
    ] = await Promise.all([
      sb.from("orders").select("id", { count: "exact", head: true }).eq("date", today),
      sb.from("orders").select("id", { count: "exact", head: true }).eq("date", tomorrow),
      sb.from("orders").select("id", { count: "exact", head: true }).gte("date", weekStart).lt("date", weekEndExclusive),
    ]);

    if (o1Err) return jsonErr(500, rid, "DB_ORDERS_TODAY", "Kunne ikke telle ordre (i dag).", o1Err);
    if (o2Err) return jsonErr(500, rid, "DB_ORDERS_TOMORROW", "Kunne ikke telle ordre (i morgen).", o2Err);
    if (o3Err) return jsonErr(500, rid, "DB_ORDERS_WEEK", "Kunne ikke telle ordre (uke).", o3Err);

    const payload: DashboardCounts = {
      companies: { ...counts },
      orders: { today: asInt(todayCount), tomorrow: asInt(tomorrowCount), week: asInt(weekCount) },
      alerts: { pendingCompanies: counts.pending, pausedCompanies: counts.paused },
    };

    return jsonOk({ ok: true, rid, data: payload });
  } catch (e: any) {
    return jsonErr(500, rid, "DASHBOARD_FAIL", "Uventet feil ved bygging av dashboard.", String(e?.message ?? e));
  }
}


