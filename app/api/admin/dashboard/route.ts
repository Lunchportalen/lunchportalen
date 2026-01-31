// app/api/admin/dashboard/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

type CountRes = { ok: true; count: number } | { ok: false; error: any };

// ✅ Tar imot query-builder og await-er den inni
async function countExact(builder: any): Promise<CountRes> {
  try {
    const { count, error } = await builder;
    if (error) return { ok: false, error };
    return { ok: true, count: Number(count ?? 0) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function errDetail(e: any) {
  if (!e) return null;
  if (typeof e === "string") return e;
  if (e instanceof Error) return { name: e.name, message: e.message };
  try {
    return JSON.parse(JSON.stringify(e));
  } catch {
    return String(e);
  }
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

/* =========================================================
   GET /api/admin/dashboard
========================================================= */
export async function GET(req: NextRequest) {
  // ✅ Late import – CI-safe
  const { supabaseServer } = await import("@/lib/supabase/server");

  const a = await scopeOr401(req);
  if ((a as any).ok === false) return (a as any).res;

  const { rid, scope } = (a as any).ctx;

  const denyRole = requireRoleOr403((a as any).ctx, "admin.dashboard.read", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403((a as any).ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr((scope as any)?.companyId);
  if (!companyId) return jsonErr(409, rid, "SCOPE_MISSING", "Mangler companyId i scope.");

  try {
    const sb = await supabaseServer();

    const todayISO = osloTodayISODate();
    const weekStart = startOfWeekISO(todayISO);
    const weekEnd = addDaysISO(weekStart, 7); // exclusive

    // Employees
    const employeesTotalP = countExact(
      sb.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("role", "employee")
    );

    const employeesActiveP = countExact(
      sb
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("role", "employee")
        .is("disabled_at", null)
    );

    const employeesDisabledP = countExact(
      sb
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("role", "employee")
        .not("disabled_at", "is", null)
    );

    // Orders (today)
    const ordersTodayActiveP = countExact(
      sb.from("orders").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("date", todayISO).eq("status", "ACTIVE")
    );

    const ordersTodayCancelledP = countExact(
      sb.from("orders").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("date", todayISO).eq("status", "CANCELLED")
    );

    // Orders (this week)
    const ordersWeekActiveP = countExact(
      sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("date", weekStart)
        .lt("date", weekEnd)
        .eq("status", "ACTIVE")
    );

    const ordersWeekCancelledP = countExact(
      sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("date", weekStart)
        .lt("date", weekEnd)
        .eq("status", "CANCELLED")
    );

    // Company status (info)
    const { data: company, error: cErr } = await sb.from("companies").select("id,name,status").eq("id", companyId).maybeSingle();
    if (cErr) return jsonErr(500, rid, "COMPANY_READ_FAILED", "Kunne ikke lese firmastatus.", errDetail(cErr));

    const results = await Promise.all([
      employeesTotalP,
      employeesActiveP,
      employeesDisabledP,
      ordersTodayActiveP,
      ordersTodayCancelledP,
      ordersWeekActiveP,
      ordersWeekCancelledP,
    ]);

    const firstErr = results.find((r) => !r.ok) as Extract<CountRes, { ok: false }> | undefined;
    if (firstErr) return jsonErr(500, rid, "COUNT_FAILED", "Kunne ikke hente dashboard-tall.", errDetail(firstErr.error));

    const [
      employeesTotal,
      employeesActive,
      employeesDisabled,
      ordersTodayActive,
      ordersTodayCancelled,
      ordersWeekActive,
      ordersWeekCancelled,
    ] = results.map((r) => (r as Extract<CountRes, { ok: true }>).count);

    return jsonOk({
      ok: true,
      rid,
      company: {
        id: (company as any)?.id ?? companyId,
        name: (company as any)?.name ?? null,
        status: (company as any)?.status ?? "active",
      },
      cutoff: { time: "08:00", tz: "Europe/Oslo" },
      dates: { todayISO, weekStartISO: weekStart, weekEndISO: weekEnd },
      employees: {
        total: employeesTotal,
        active: employeesActive,
        disabled: employeesDisabled,
      },
      orders: {
        today: { active: ordersTodayActive, cancelled: ordersTodayCancelled },
        week: { active: ordersWeekActive, cancelled: ordersWeekCancelled },
      },
    });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", "Uventet feil.", errDetail(e));
  }
}
