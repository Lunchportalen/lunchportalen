// app/api/admin/dashboard/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

/**
 * Hent innlogget user + profile og verifiser at han er company_admin.
 * Viktig: company_id hentes fra DB, aldri fra klient.
 */
async function requireCompanyAdmin() {
  const sb = await supabaseServer();

  const {
    data: { user },
    error: uerr,
  } = await sb.auth.getUser();

  if (uerr || !user) throw Object.assign(new Error("not_authenticated"), { code: "not_authenticated" });

  const role = String(user.user_metadata?.role ?? "employee").trim().toLowerCase();
  if (role !== "company_admin") throw Object.assign(new Error("forbidden"), { code: "forbidden" });

  const { data: profile, error: perr } = await sb
    .from("profiles")
    .select("user_id, company_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (perr) throw Object.assign(new Error("db_error"), { code: "db_error", detail: perr });
  if (!profile?.company_id) throw Object.assign(new Error("missing_company"), { code: "missing_company" });
  if (String(profile.role ?? "").toLowerCase() !== "company_admin")
    throw Object.assign(new Error("role_mismatch"), { code: "role_mismatch" });

  return { sb, user, companyId: profile.company_id as string };
}

// Helper for count-only queries
async function countExact(q: any): Promise<number> {
  const { count, error } = await q;
  if (error) throw error;
  return Number(count ?? 0);
}

export async function GET(req: NextRequest) {
  const rid = `admin_dash_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { sb, companyId } = await requireCompanyAdmin();

    const todayISO = osloTodayISODate();
    const weekStart = startOfWeekISO(todayISO);
    const weekEnd = addDaysISO(weekStart, 7); // exclusive

    // ----------------------------
    // Employees
    // ----------------------------
    const employeesTotalP = countExact(
      sb
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("role", "employee")
    );

    const employeesActiveP = countExact(
      sb
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("role", "employee")
        .is("disabled_at", null)
    );

    const employeesDisabledP = countExact(
      sb
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("role", "employee")
        .not("disabled_at", "is", null)
    );

    // ----------------------------
    // Orders (today)
    // ----------------------------
    const ordersTodayActiveP = countExact(
      sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("date", todayISO)
        .eq("status", "ACTIVE")
    );

    const ordersTodayCancelledP = countExact(
      sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("date", todayISO)
        .eq("status", "CANCELLED")
    );

    // ----------------------------
    // Orders (this week)
    // ----------------------------
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

    // ----------------------------
    // Company status (info)
    // ----------------------------
    const { data: company, error: cErr } = await sb
      .from("companies")
      .select("id,name,status")
      .eq("id", companyId)
      .maybeSingle();

    if (cErr) return jsonError(500, "company_read_failed", "Kunne ikke lese firmastatus.", cErr);

    const [
      employeesTotal,
      employeesActive,
      employeesDisabled,
      ordersTodayActive,
      ordersTodayCancelled,
      ordersWeekActive,
      ordersWeekCancelled,
    ] = await Promise.all([
      employeesTotalP,
      employeesActiveP,
      employeesDisabledP,
      ordersTodayActiveP,
      ordersTodayCancelledP,
      ordersWeekActiveP,
      ordersWeekCancelledP,
    ]);

    return NextResponse.json(
      {
        ok: true,
        rid,
        company: {
          id: company?.id ?? companyId,
          name: company?.name ?? null,
          status: company?.status ?? "active",
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
      },
      { status: 200 }
    );
  } catch (e: any) {
    const code = e?.code || "unknown";
    if (code === "not_authenticated") return jsonError(401, "not_authenticated", "Du må være innlogget.");
    if (code === "forbidden") return jsonError(403, "forbidden", "Ingen tilgang.");
    if (code === "missing_company") return jsonError(400, "missing_company", "Mangler company_id på admin-profilen.");
    if (code === "role_mismatch") return jsonError(403, "role_mismatch", "Rolle mismatch mellom auth og profil.");
    if (code === "db_error") return jsonError(500, "db_error", "Databasefeil.", e?.detail);
    return jsonError(500, "server_error", "Uventet feil.", String(e?.message ?? e));
  }
}
