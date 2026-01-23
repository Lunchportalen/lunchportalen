// app/api/admin/metrics/daily/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { osloTodayISODate } from "../../../../lib/date/oslo";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function subDaysISO(dateISO: string, days: number) {
  const d = new Date(dateISO + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() - days);
  return isoDate(d);
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
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  return { dateISO: `${y}-${m}-${d}`, hh, mm };
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

export async function GET(req: Request) {
  const supabase = await supabaseServer();

  // 1) auth
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return jsonError(401, "not_authenticated", "Ikke innlogget");

  const role = String(userData.user.user_metadata?.role ?? "employee");
  if (role !== "company_admin") return jsonError(403, "forbidden", "Kun company_admin");

  // 2) find admin's company_id via profiles (RLS will enforce)
  const { data: me, error: meErr } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("user_id", userData.user.id)
    .single();

  if (meErr || !me?.company_id) {
    return jsonError(400, "no_company", "Fant ikke company_id på innlogget bruker", meErr);
  }

  const companyId = String(me.company_id);

  // 3) company status gate
  const { data: company, error: compErr } = await supabase
    .from("companies")
    .select("id,status")
    .eq("id", companyId)
    .single();

  if (compErr || !company) return jsonError(404, "company_not_found", "Fant ikke firma", compErr);
  if (String((company as any).status) !== "active") {
    return jsonError(403, "company_not_active", "Firma er ikke aktivt");
  }

  // 4) period: default 14 days (inclusive). Optional query param: ?days=7/14/30 (clamped 7..30)
  const url = new URL(req.url);
  const daysRaw = Number(url.searchParams.get("days") ?? 14);
  const days = Number.isFinite(daysRaw) ? Math.min(30, Math.max(7, Math.floor(daysRaw))) : 14;

  const today = osloTodayISODate(); // YYYY-MM-DD (Oslo)
  const from = subDaysISO(today, days - 1); // inclusive range

  // Fetch orders for date window
  const { data: rows, error } = await supabase
    .from("orders")
    .select("date,status,cancelled_at,updated_at")
    .eq("company_id", companyId)
    .gte("date", from)
    .lte("date", today);

  if (error) return jsonError(500, "query_failed", "Kunne ikke hente dagserie", error);

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
    const day = String((r as any).date);
    const status = String((r as any).status);
    const cur = map.get(day) ?? { date: day, orders: 0, cancelled: 0, cancelled_before_0800: 0 };

    cur.orders += 1;

    if (status === "cancelled") {
      cur.cancelled += 1;

      const ts = (r as any).cancelled_at ?? (r as any).updated_at ?? null;
      const tsISO = ts ? String(ts) : null;

      if (cancelledBefore0800Oslo(day, tsISO)) {
        cur.cancelled_before_0800 += 1;
      }
    }

    map.set(day, cur);
  }

  const series = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));

  const totals = series.reduce(
    (acc, p) => {
      acc.orders += p.orders;
      acc.cancelled += p.cancelled;
      acc.cancelled_before_0800 += p.cancelled_before_0800;
      return acc;
    },
    { orders: 0, cancelled: 0, cancelled_before_0800: 0 }
  );

  return NextResponse.json({
    ok: true,
    companyId,
    from,
    to: today,
    days,
    series,
    totals,
    meta: {
      cancellation_source: "cancelled_at fallback to updated_at",
    },
  });
}
