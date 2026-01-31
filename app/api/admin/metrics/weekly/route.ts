// app/api/admin/metrics/weekly/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { osloTodayISODate, startOfWeekISO, addDaysISO } from "@/lib/date/oslo";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

type WeekPoint = {
  weekStartISO: string; // Monday YYYY-MM-DD
  from: string; // inclusive
  to: string; // exclusive
  orders: number;
  cancelled: number;
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function clampInt(v: any, def: number, min: number, max: number) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
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

export async function GET(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.metrics.weekly", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(scope.companyId);
  if (!companyId) return jsonErr(409, rid, "SCOPE_MISSING", "Mangler companyId i scope.");

  try {
    const sb = await supabaseServer();

    // Company active gate
    const { data: company, error: compErr } = await sb.from("companies").select("id,status").eq("id", companyId).maybeSingle();

    if (compErr) return jsonErr(500, rid, "COMPANY_READ_FAILED", "Kunne ikke lese firma.", { message: compErr.message });
    if (!company) return jsonErr(404, rid, "COMPANY_NOT_FOUND", "Fant ikke firma.");

    const cStatus = normCompanyStatus((company as any).status);
    if (cStatus !== "ACTIVE") return jsonErr(403, rid, "COMPANY_NOT_ACTIVE", "Firma er ikke aktivt.", { status: cStatus });

    // weeks: default 8 (clamped 4..26). Optional: ?weeks=4/8/12/26
    const url = new URL(req.url);
    const weeks = clampInt(url.searchParams.get("weeks"), 8, 4, 26);

    const todayISO = osloTodayISODate();
    const thisWeekStart = startOfWeekISO(todayISO); // Monday
    const fromISO = addDaysISO(thisWeekStart, -(weeks - 1) * 7); // Monday weeks-1 back
    const toISO = addDaysISO(thisWeekStart, 7); // exclusive end of current week

    // Fetch orders in window
    const { data: rows, error } = await sb
      .from("orders")
      .select("date,status")
      .eq("company_id", companyId)
      .gte("date", fromISO)
      .lt("date", toISO);

    if (error) return jsonErr(500, rid, "QUERY_FAILED", "Kunne ikke hente ukeserie.", { message: error.message });

    // Init buckets
    const buckets = new Map<string, WeekPoint>();
    for (let i = 0; i < weeks; i++) {
      const ws = addDaysISO(fromISO, i * 7);
      const we = addDaysISO(ws, 7);
      buckets.set(ws, { weekStartISO: ws, from: ws, to: we, orders: 0, cancelled: 0 });
    }

    // Aggregate
    for (const r of rows ?? []) {
      const date = safeStr((r as any).date);
      if (!date) continue;

      const status = normOrderStatus((r as any).status);

      const ws = startOfWeekISO(date);
      const cur = buckets.get(ws);
      if (!cur) continue;

      cur.orders += 1;
      if (status === "CANCELLED") cur.cancelled += 1;
    }

    const series = Array.from(buckets.values()).sort((a, b) => a.weekStartISO.localeCompare(b.weekStartISO));

    const totals = series.reduce(
      (acc, p) => {
        acc.orders += p.orders;
        acc.cancelled += p.cancelled;
        return acc;
      },
      { orders: 0, cancelled: 0 }
    );

    return jsonOk({
      ok: true,
      rid,
      companyId,
      weeks,
      range: { from: fromISO, to: toISO },
      series,
      totals,
      meta: { status_cancelled_value: "CANCELLED", weekStart: "Monday (Europe/Oslo)" },
    });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}


