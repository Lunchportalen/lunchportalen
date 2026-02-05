// app/api/admin/insight/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function clamp01(x: number) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
function safeStr(v: any) {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.insight.read", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(scope.companyId);
  const userId = safeStr(scope.userId);

  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");
  if (!userId) return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTH");

  try {
    const admin = supabaseAdmin();

    // Deaktivert konto? (service role: sjekk profiles.disabled_at)
    const { data: prof, error: profErr } = await admin.from("profiles").select("disabled_at").eq("id", userId).maybeSingle();

    if (profErr) return jsonErr(rid, "Kunne ikke lese profil.", 500, { code: "PROFILE_READ_FAILED", detail: { message: profErr.message } });
    if (prof?.disabled_at) return jsonErr(rid, "Kontoen er deaktivert.", 403, "ACCOUNT_DISABLED");

    // Period (siste 14 dager, uten hull)
    const today = osloTodayISODate();
    const from = addDaysISO(today, -14);
    const to = addDaysISO(today, 1); // inkl today (for query range)

    // Orders per dag (ACTIVE/CANCELLED)
    const { data: orders, error: ordersErr } = await admin
      .from("orders")
      .select("date,status")
      .eq("company_id", companyId)
      .gte("date", from)
      .lte("date", to);

    if (ordersErr) return jsonErr(rid, "Kunne ikke hente ordre.", 500, { code: "ORDERS_READ_FAILED", detail: { message: ordersErr.message } });

    const byDay: Record<string, { active: number; cancelled: number }> = {};

    for (const o of orders ?? []) {
      const d = safeStr((o as any).date);
      if (!d) continue;

      if (!byDay[d]) byDay[d] = { active: 0, cancelled: 0 };

      const st = safeStr((o as any).status).toUpperCase();

      if (st === "ACTIVE") byDay[d].active += 1;
      else if (st === "CANCELLED" || st === "CANCELLED_BY_USER" || st === "CANCELED") byDay[d].cancelled += 1;
    }

    // Serie for siste 14 dager (uten hull)
    const days: { date: string; active: number; cancelled: number }[] = [];
    for (let i = 14; i >= 1; i--) {
      const d = addDaysISO(today, -i);
      const v = byDay[d] ?? { active: 0, cancelled: 0 };
      days.push({ date: d, active: v.active, cancelled: v.cancelled });
    }

    // Stabilitet / avvik
    const actives = days.map((x) => x.active);
    const mean = avg(actives);
    const variance = actives.length ? avg(actives.map((x) => (x - mean) ** 2)) : 0;
    const std = Math.sqrt(variance);

    const cv = mean > 0 ? std / mean : 0;
    const variationScore = clamp01(cv / 0.6); // 0..1 (0.6 = høy variasjon)
    const level = variationScore < 0.33 ? "lav" : variationScore < 0.66 ? "middels" : "høy";

    // Forventet i morgen (enkel baseline)
    const forecast = Math.round(mean);

    // Matsvinn-indikator
    const cancelledTotal = days.reduce((a, b) => a + b.cancelled, 0);
    const activeTotal = days.reduce((a, b) => a + b.active, 0);
    const denom = activeTotal + cancelledTotal;
    const cancelRate = denom > 0 ? cancelledTotal / denom : 0;

    const wasteScore = clamp01(variationScore * 0.6 + cancelRate * 0.4);
    const wasteLevel = wasteScore < 0.33 ? "low" : wasteScore < 0.66 ? "medium" : "high";

    // Varsler
    const alerts: string[] = [];
    if (cancelRate > 0.25) alerts.push("Uvanlig mange avbestillinger siste 14 dager.");
    if (variationScore > 0.66) alerts.push("Stor variasjon i antall bestillinger siste 14 dager.");
    if (mean < 3) alerts.push("Få datapunkter – innsikt kan være mindre presis.");

    return jsonOk(rid, {
      companyId,
      range: { from, to: today },
      forecast: { expectedTomorrow: forecast, confidence: mean >= 8 ? "high" : mean >= 4 ? "medium" : "low" },
      stability: { level, deviationPercent: Math.round(variationScore * 100) },
      waste: { level: wasteLevel, cancelRate: Math.round(cancelRate * 100) },
      series: days,
      alerts,
    });
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String(e?.message ?? e) } });
  }
}
