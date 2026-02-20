// app/api/admin/insights/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, q } from "@/lib/http/routeGuard";
import { addDaysISO, osloTodayISODate, OSLO_TZ } from "@/lib/date/oslo";
import { auditAdmin } from "@/lib/audit/actions";

type RangeKey = "7d" | "14d" | "30d";

type DaySummary = {
  date: string;
  orders: number;
  cancelled_before_cutoff: number;
  cancelled_after_cutoff: number;
};

function parseRange(v: string | null): { key: RangeKey; days: number } {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "30d") return { key: "30d", days: 30 };
  if (s === "14d") return { key: "14d", days: 14 };
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

function listDatesISO(from: string, to: string) {
  const out: string[] = [];
  let cur = from;
  for (let i = 0; i < 366; i += 1) {
    out.push(cur);
    if (cur === to) break;
    cur = addDaysISO(cur, 1);
  }
  return out;
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
    const cancelledAfterCount = Math.max(0, cancelledTotal - cancelledBeforeCount);

    const dayMap = new Map<string, DaySummary>();
    for (const d of listDatesISO(from, to)) {
      dayMap.set(d, { date: d, orders: 0, cancelled_before_cutoff: 0, cancelled_after_cutoff: 0 });
    }

    for (const o of orders) {
      const entry = dayMap.get(o.date) ?? { date: o.date, orders: 0, cancelled_before_cutoff: 0, cancelled_after_cutoff: 0 };
      entry.orders += 1;

      if (String(o.status ?? "").toUpperCase() === "CANCELLED") {
        const before = isCancelledBeforeCutoff(o.date, o.updated_at ?? o.created_at);
        if (before) entry.cancelled_before_cutoff += 1;
        else entry.cancelled_after_cutoff += 1;
      }

      dayMap.set(o.date, entry);
    }

    const dailySummary = Array.from(dayMap.values());
    const totalOrders = orders.length;
    const activeDays = dailySummary.filter((d) => d.orders > 0).length;
    const avgOrdersPerDay = activeDays > 0 ? totalOrders / activeDays : null;
    const daysWithDeviations = dailySummary.filter((d) => d.orders > 0 && d.cancelled_after_cutoff > 0).length;
    const daysWithNoDeviations = Math.max(0, activeDays - daysWithDeviations);

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
      deliveries: {
        total_orders: totalOrders,
        active_days: activeDays,
        avg_orders_per_day: avgOrdersPerDay,
      },
      cancellations_before_cutoff: {
        count: cancelledBeforeCount,
        total_cancelled: cancelledTotal,
        rate: cancelledBeforeRate,
      },
      cancellations_after_cutoff: {
        count: cancelledAfterCount,
      },
      daily_summary: dailySummary,
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
        available: true,
        days_with_no_deviations: daysWithNoDeviations,
        days_with_deviations: daysWithDeviations,
        note: "Avvik målt som kanselleringer etter cut-off.",
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
        cancelled_after_cutoff: cancelledAfterCount,
        deliveries_total_orders: totalOrders,
        deliveries_active_days: activeDays,
        adoption_active_users_14d: activeUserIds.size,
        adoption_total_employees: employeesActiveTotal,
      },
    });

    return jsonOk(rid, data, 200);
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String(e?.message ?? e) } });
  }
}
