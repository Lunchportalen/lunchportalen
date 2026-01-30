// app/api/admin/metrics/daily/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { osloTodayISODate } from "@/lib/date/oslo";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

/* =========================================================
   Date helpers
========================================================= */

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function subDaysISO(dateISO: string, days: number) {
  const d = new Date(dateISO + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() - days);
  return isoDate(d);
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function normCompanyStatus(v: any) {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  if (s === "PENDING") return "PENDING";
  return "UNKNOWN";
}

function normOrderStatus(v: any) {
  return safeStr(v).toUpperCase();
}

type DayPoint = {
  date: string; // YYYY-MM-DD (delivery date)
  orders: number; // total orders for that day
  cancelled: number; // cancelled orders for that day
  cancelled_before_0800: number; // cancelled before 08:00 Oslo
};

function getOsloParts(dt: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(dt);

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");

  return { dateISO: `${y}-${m}-${d}`, hh };
}

/**
 * Cancellation is considered "before 08:00 Oslo" if:
 * - cancellation timestamp interpreted in Oslo time is on the same Oslo date as delivery date
 * - and time < 08:00
 */
function cancelledBefore0800Oslo(deliveryDateISO: string, cancelledAtISO: string | null) {
  if (!cancelledAtISO) return false;
  const c = getOsloParts(new Date(cancelledAtISO));
  if (c.dateISO !== deliveryDateISO) return false;
  return c.hh < 8; // strictly before 08:00
}

export async function GET(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.metrics.daily", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  if (!companyId) return jsonErr(409, rid, "SCOPE_MISSING", "Mangler companyId i scope.");

  try {
    const sb = await supabaseServer();

    // Company status gate (må være ACTIVE)
    const { data: company, error: compErr } = await sb.from("companies").select("id,status").eq("id", companyId).maybeSingle();

    if (compErr) return jsonErr(500, rid, "COMPANY_READ_FAILED", "Kunne ikke lese firma.", { message: compErr.message });
    if (!company) return jsonErr(404, rid, "COMPANY_NOT_FOUND", "Fant ikke firma.");

    const cStatus = normCompanyStatus((company as any).status);
    if (cStatus !== "ACTIVE") return jsonErr(403, rid, "COMPANY_NOT_ACTIVE", "Firma er ikke aktivt.", { status: cStatus });

    // period: default 14 days (inclusive). Optional query param: ?days=7/14/30 (clamped 7..30)
    const url = new URL(req.url);
    const daysRaw = Number(url.searchParams.get("days") ?? 14);
    const days = Number.isFinite(daysRaw) ? Math.min(30, Math.max(7, Math.floor(daysRaw))) : 14;

    const today = osloTodayISODate(); // YYYY-MM-DD (Oslo)
    const from = subDaysISO(today, days - 1); // inclusive range

    // Fetch orders for date window (RLS via supabaseServer)
    const { data: rows, error } = await sb
      .from("orders")
      .select("date,status,cancelled_at,updated_at")
      .eq("company_id", companyId)
      .gte("date", from)
      .lte("date", today);

    if (error) return jsonErr(500, rid, "QUERY_FAILED", "Kunne ikke hente dagserie.", { message: error.message });

    // Initialize stable series: one point per day
    const map = new Map<string, DayPoint>();
    for (let i = 0; i < days; i++) {
      const d = new Date(from + "T00:00:00.000Z");
      d.setUTCDate(d.getUTCDate() + i);
      const dayISO = isoDate(d);
      map.set(dayISO, { date: dayISO, orders: 0, cancelled: 0, cancelled_before_0800: 0 });
    }

    // Aggregate
    for (const r of rows ?? []) {
      const day = safeStr((r as any).date);
      if (!day) continue;

      const status = normOrderStatus((r as any).status);
      const cur = map.get(day) ?? { date: day, orders: 0, cancelled: 0, cancelled_before_0800: 0 };

      cur.orders += 1;

      if (status === "CANCELLED") {
        cur.cancelled += 1;

        const ts = (r as any).cancelled_at ?? (r as any).updated_at ?? null;
        const tsISO = ts ? String(ts) : null;

        if (cancelledBefore0800Oslo(day, tsISO)) {
          cur.cancelled_before_0800 += 1;
        }
      }

      map.set(day, cur);
    }

    const series = Array.from(map.values()).sort((x, y) => x.date.localeCompare(y.date));

    const totals = series.reduce(
      (acc, p) => {
        acc.orders += p.orders;
        acc.cancelled += p.cancelled;
        acc.cancelled_before_0800 += p.cancelled_before_0800;
        return acc;
      },
      { orders: 0, cancelled: 0, cancelled_before_0800: 0 }
    );

    return jsonOk({
      ok: true,
      rid,
      companyId,
      from,
      to: today,
      days,
      series,
      totals,
      meta: {
        cancellation_source: "cancelled_at fallback to updated_at",
        cutoff: { time: "08:00", tz: "Europe/Oslo" },
        status_cancelled_value: "CANCELLED",
      },
    });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}
