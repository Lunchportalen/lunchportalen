// app/api/admin/dashboard/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function ridFrom(req: NextRequest) {
  return safeStr(req.headers.get("x-rid")) || `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

type CountRes = { ok: true; count: number } | { ok: false; error: any };

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

/**
 * GET /api/admin/dashboard
 * - company_admin / superadmin / admin
 * - Runtime-only + CI-safe (ingen env/importkjeder ved build)
 */
export async function GET(req: NextRequest) {
  try {
    // ✅ LATE IMPORT – stopper env-evaluering under next build
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;
    const ctx = gate.ctx;

    const denyRole = requireRoleOr403(ctx, "admin.dashboard.read", ["company_admin", "superadmin"]);
    if (denyRole) return denyRole;

    const denyScope = requireCompanyScopeOr403(ctx);
    if (denyScope) return denyScope;

    const companyId = safeStr(ctx.scope.companyId);
    if (!companyId) return jsonErr(ctx.rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

    const todayISO = osloTodayISODate();
    const weekStart = startOfWeekISO(todayISO);
    const weekEnd = addDaysISO(weekStart, 7); // exclusive

    // Employees
    const employeesTotalP = countExact(
      sb.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("role", "employee")
    );

    const employeesActiveP = countExact(
      sb.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("role", "employee").is("disabled_at", null)
    );

    const employeesDisabledP = countExact(
      sb.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("role", "employee").not("disabled_at", "is", null)
    );

    // Orders (today)
    const ordersTodayActiveP = countExact(
      sb.from("orders").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("date", todayISO).eq("status", "ACTIVE")
    );

    const ordersTodayCancelledP = countExact(
      sb.from("orders").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("date", todayISO).eq("status", "CANCELLED")
    );

    // Orders (week)
    const ordersWeekActiveP = countExact(
      sb.from("orders").select("id", { count: "exact", head: true }).eq("company_id", companyId).gte("date", weekStart).lt("date", weekEnd).eq("status", "ACTIVE")
    );

    const ordersWeekCancelledP = countExact(
      sb.from("orders").select("id", { count: "exact", head: true }).eq("company_id", companyId).gte("date", weekStart).lt("date", weekEnd).eq("status", "CANCELLED")
    );

    // Company info
    const { data: company, error: cErr } = await sb.from("companies").select("id,name,status").eq("id", companyId).maybeSingle();
    if (cErr) return jsonErr(ctx.rid, "Kunne ikke lese firmastatus.", 400, { code: "COMPANY_READ_FAILED", detail: errDetail(cErr) });

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
    if (firstErr) return jsonErr(ctx.rid, "Kunne ikke hente dashboard-tall.", 400, { code: "COUNT_FAILED", detail: errDetail(firstErr.error) });

    const [
      employeesTotal,
      employeesActive,
      employeesDisabled,
      ordersTodayActive,
      ordersTodayCancelled,
      ordersWeekActive,
      ordersWeekCancelled,
    ] = results.map((r) => (r as Extract<CountRes, { ok: true }>).count);

    return jsonOk(ctx.rid, {
      company: {
        id: (company as any)?.id ?? companyId,
        name: (company as any)?.name ?? null,
        status: (company as any)?.status ?? "active",
      },
      cutoff: { time: "08:00", tz: "Europe/Oslo" },
      dates: { todayISO, weekStartISO: weekStart, weekEndISO: weekEnd },
      employees: { total: employeesTotal, active: employeesActive, disabled: employeesDisabled },
      orders: {
        today: { active: ordersTodayActive, cancelled: ordersTodayCancelled },
        week: { active: ordersWeekActive, cancelled: ordersWeekCancelled },
      },
    });
  } catch (e: any) {
    const rid = ridFrom(req);
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: errDetail(e) });
  }
}
