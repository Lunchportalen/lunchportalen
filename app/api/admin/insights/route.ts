// app/api/admin/insights/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, q } from "@/lib/http/routeGuard";
import { addDaysISO, osloTodayISODate, OSLO_TZ } from "@/lib/date/oslo";
import { auditAdmin } from "@/lib/audit/actions";

type RangeKey = "7d" | "30d";

function parseRange(v: string | null): { key: RangeKey; days: number } {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "30d") return { key: "30d", days: 30 };
  return { key: "7d", days: 7 };
}

function toOsloParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OSLO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    yyyy: get("year"),
    mm: get("month"),
    dd: get("day"),
    hh: Number(get("hour")),
    mi: Number(get("minute")),
  };
}

function isCancelledBeforeCutoff(orderDateISO: string, updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return false;
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return false;
  const p = toOsloParts(d);
  const dateLocal = `${p.yyyy}-${p.mm}-${p.dd}`;
  if (dateLocal < orderDateISO) return true;
  if (dateLocal > orderDateISO) return false;
  const minutes = p.hh * 60 + p.mi;
  return minutes < 8 * 60;
}

function toStartOfDayUtc(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`).toISOString();
}

export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.insights.read", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  const actorUserId = String(scope.userId ?? "").trim();
  const actorEmail = scope.email ?? null;
  const locationId = scope.locationId ?? null;

  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const range = parseRange(q(req, "range"));
  const today = osloTodayISODate();
  const from = addDaysISO(today, -(range.days - 1));
  const to = today;

  const admin = supabaseAdmin();

  try {
    const ordersRes = await admin
      .from("orders")
      .select("id,user_id,status,date,created_at,updated_at")
      .eq("company_id", companyId)
      .gte("date", from)
      .lte("date", to);

    if (ordersRes.error) {
      return jsonErr(rid, "Kunne ikke hente ordredata.", 500, { code: "ORDERS_FETCH_FAILED", detail: ordersRes.error });
    }

    const orders = (ordersRes.data ?? []) as Array<{
      id: string;
      user_id: string | null;
      status: string | null;
      date: string;
      created_at: string | null;
      updated_at: string | null;
    }>;

    const cancelled = orders.filter((o) => String(o.status ?? "").toUpperCase() === "CANCELLED");
    const cancelledBefore = cancelled.filter((o) => isCancelledBeforeCutoff(o.date, o.updated_at ?? o.created_at));

    const cancelledTotal = cancelled.length;
    const cancelledBeforeCount = cancelledBefore.length;
    const cancelledBeforeRate = cancelledTotal > 0 ? cancelledBeforeCount / cancelledTotal : null;

    const start14 = addDaysISO(today, -13);
    const start14Ts = toStartOfDayUtc(start14);
    const activityRes = await admin
      .from("orders")
      .select("user_id,created_at,updated_at")
      .eq("company_id", companyId)
      .or(`created_at.gte.${start14Ts},updated_at.gte.${start14Ts}`);

    if (activityRes.error) {
      return jsonErr(rid, "Kunne ikke hente aktivitetsdata.", 500, { code: "ACTIVITY_FETCH_FAILED", detail: activityRes.error });
    }

    const activeUserIds = new Set<string>();
    for (const r of (activityRes.data ?? []) as any[]) {
      const uid = String(r?.user_id ?? "").trim();
      if (uid) activeUserIds.add(uid);
    }

    const employeesTotalRes = await admin
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("role", "employee")
      .is("disabled_at", null);

    if (employeesTotalRes.error) {
      return jsonErr(rid, "Kunne ikke hente antall ansatte.", 500, { code: "EMPLOYEE_COUNT_FAILED", detail: employeesTotalRes.error });
    }

    const employeesActiveTotal = Number(employeesTotalRes.count ?? 0);
    const adoptionRate = employeesActiveTotal > 0 ? activeUserIds.size / employeesActiveTotal : null;

    const data = {
      range: range.key,
      window: { from, to },
      cancellations_before_cutoff: {
        count: cancelledBeforeCount,
        total_cancelled: cancelledTotal,
        rate: cancelledBeforeRate,
      },
      saved_meals_proxy: {
        count: cancelledBeforeCount,
      },
      waste_reduced_proxy: {
        meals: cancelledBeforeCount,
      },
      adoption: {
        active_users_14d: activeUserIds.size,
        total_employees: employeesActiveTotal,
        rate_14d: adoptionRate,
      },
      delivery_stability: {
        available: false,
        message: "Ikke tilgjengelig (ingen avviksdata).",
      },
    };

    await auditAdmin({
      actor_user_id: actorUserId,
      actor_email: actorEmail,
      action: "admin.insights.read",
      company_id: companyId,
      location_id: locationId,
      meta: {
        rid,
        range: range.key,
        from,
        to,
        cancelled_before_cutoff: cancelledBeforeCount,
        cancelled_total: cancelledTotal,
        adoption_active_users_14d: activeUserIds.size,
        adoption_total_employees: employeesActiveTotal,
      },
    });

    return jsonOk(rid, data, 200);
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String(e?.message ?? e) } });
  }
}
