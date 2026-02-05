// app/api/admin/metrics/summary/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { osloTodayISODate } from "@/lib/date/oslo";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function clampInt(v: any, def: number, min: number, max: number) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}
function subDaysISO(dateISO: string, days: number) {
  const d = new Date(dateISO + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
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

  const denyRole = requireRoleOr403(a.ctx, "admin.metrics.summary", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(scope.companyId);
  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  try {
    const sb = await supabaseServer();

    // Company active gate
    const { data: company, error: compErr } = await sb.from("companies").select("id,status").eq("id", companyId).maybeSingle();

    if (compErr) return jsonErr(rid, "Kunne ikke lese firma.", 500, { code: "COMPANY_READ_FAILED", detail: { message: compErr.message } });
    if (!company) return jsonErr(rid, "Fant ikke firma.", 404, "COMPANY_NOT_FOUND");

    const cStatus = normCompanyStatus((company as any).status);
    if (cStatus !== "ACTIVE") return jsonErr(rid, "Firma er ikke aktivt.", 403, { code: "COMPANY_NOT_ACTIVE", detail: { status: cStatus } });

    // Window: default 30 days (clamped 7..90)
    const url = new URL(req.url);
    const days = clampInt(url.searchParams.get("days"), 30, 7, 90);

    const todayISO = osloTodayISODate();
    const fromISO = subDaysISO(todayISO, days - 1);

    // Orders in window
    const { data: rows, error } = await sb.from("orders").select("date,status").eq("company_id", companyId).gte("date", fromISO).lte("date", todayISO);

    if (error) return jsonErr(rid, "Kunne ikke hente sammendrag.", 500, { code: "QUERY_FAILED", detail: { message: error.message } });

    // Aggregate
    let orders = 0;
    let cancelled = 0;

    for (const r of rows ?? []) {
      orders += 1;
      const status = normOrderStatus((r as any).status);
      if (status === "CANCELLED") cancelled += 1;
    }

    const active = Math.max(0, orders - cancelled);
    const cancellation_rate = orders > 0 ? Number((cancelled / orders).toFixed(4)) : 0;

    return jsonOk(rid, {
      companyId,
      window: { from: fromISO, to: todayISO, days },
      totals: { orders, active, cancelled, cancellation_rate },
      meta: { status_cancelled_value: "CANCELLED" },
    });
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String(e?.message ?? e) } });
  }
}
