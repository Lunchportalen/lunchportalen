// app/api/admin/dashboard/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function ridFrom(req: NextRequest) {
  return safeStr(req.headers.get("x-rid")) || `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function ok(rid: string, body: any, status = 200) {
  return NextResponse.json({ ok: true, rid, ...body }, { status });
}
function err(rid: string, status: number, code: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error: code, message, detail: detail ?? null }, { status });
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
  const rid = ridFrom(req);

  try {
    // ✅ LATE IMPORT – stopper env-evaluering under next build
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    // 1) Auth (fail-closed)
    const { data: auth, error: authErr } = await sb.auth.getUser();
    const user = auth?.user ?? null;
    if (authErr || !user) return err(rid, 401, "UNAUTHENTICATED", "Du må være innlogget.");

    // 2) Profile role/companyId
    const { data: prof, error: profErr } = await sb
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) return err(rid, 500, "PROFILE_READ_FAILED", "Kunne ikke lese profil.", { message: profErr.message });

    const role = safeStr((prof as any)?.role);
    const companyId = safeStr((prof as any)?.company_id);

    // Tillatt: company_admin (krever companyId), superadmin/admin (kan også ha companyId)
    if (!["company_admin", "superadmin", "admin"].includes(role)) {
      return err(rid, 403, "FORBIDDEN", "Ingen tilgang.");
    }
    if (role === "company_admin" && !companyId) {
      return err(rid, 409, "SCOPE_MISSING", "Mangler companyId i scope.");
    }

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
    if (cErr) return err(rid, 500, "COMPANY_READ_FAILED", "Kunne ikke lese firmastatus.", errDetail(cErr));

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
    if (firstErr) return err(rid, 500, "COUNT_FAILED", "Kunne ikke hente dashboard-tall.", errDetail(firstErr.error));

    const [
      employeesTotal,
      employeesActive,
      employeesDisabled,
      ordersTodayActive,
      ordersTodayCancelled,
      ordersWeekActive,
      ordersWeekCancelled,
    ] = results.map((r) => (r as Extract<CountRes, { ok: true }>).count);

    return ok(rid, {
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
    return err(rid, 500, "UNHANDLED", "Uventet feil.", errDetail(e));
  }
}
