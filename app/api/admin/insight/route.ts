// app/api/admin/insight/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function roleByEmail(email: string | null | undefined): Role | null {
  const e = normEmail(email);
  if (e === "superadmin@lunchportalen.no") return "superadmin";
  if (e === "kjokken@lunchportalen.no") return "kitchen";
  if (e === "driver@lunchportalen.no") return "driver";
  return null;
}
function roleFromMetadata(user: any): Role {
  const raw = String(user?.user_metadata?.role ?? "employee").toLowerCase();
  if (raw === "company_admin") return "company_admin";
  if (raw === "superadmin") return "superadmin";
  if (raw === "kitchen") return "kitchen";
  if (raw === "driver") return "driver";
  return "employee";
}
function computeRole(user: any, profileRole?: any): Role {
  const byEmail = roleByEmail(user?.email);
  if (byEmail) return byEmail;
  const pr = String(profileRole ?? "").toLowerCase();
  if (pr === "company_admin") return "company_admin";
  if (pr === "superadmin") return "superadmin";
  if (pr === "kitchen") return "kitchen";
  if (pr === "driver") return "driver";
  if (pr === "employee") return "employee";
  return roleFromMetadata(user);
}

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function clamp01(x: number) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export async function GET() {
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) return jsonError(401, "UNAUTHENTICATED", "Not logged in");

  const admin = supabaseAdmin();

  // profile for company_id + role gate
  const prof = await admin.from("profiles").select("role, company_id, disabled_at").eq("user_id", user.id).maybeSingle();
  if (prof.error) return jsonError(500, "PROFILE_READ_FAILED", "Could not read profile", prof.error);

  const role = computeRole(user, prof.data?.role);
  if (role !== "company_admin") return jsonError(403, "FORBIDDEN", "Admin only");

  if (prof.data?.disabled_at) return jsonError(403, "ACCOUNT_DISABLED", "Account disabled");

  const companyId = prof.data?.company_id;
  if (!companyId) return jsonError(409, "MISSING_COMPANY_ID", "Missing company_id");

  const today = osloTodayISODate();
  const from = addDaysISO(today, -14);
  const to = addDaysISO(today, 1); // inkl today

  // hent ordretelling per dag (ACTIVE/CANCELLED)
  const { data: orders, error: ordersErr } = await admin
    .from("orders")
    .select("date, status")
    .eq("company_id", companyId)
    .gte("date", from)
    .lte("date", to);

  if (ordersErr) return jsonError(500, "ORDERS_READ_FAILED", "Could not read orders", ordersErr);

  const byDay: Record<string, { active: number; cancelled: number }> = {};
  for (const o of orders ?? []) {
    const d = String((o as any).date);
    if (!byDay[d]) byDay[d] = { active: 0, cancelled: 0 };
    const st = String((o as any).status ?? "").toUpperCase();
    if (st === "ACTIVE") byDay[d].active += 1;
    else if (st === "CANCELLED") byDay[d].cancelled += 1;
  }

  // bygg serie for siste 14 dager (uten hull)
  const days: { date: string; active: number; cancelled: number }[] = [];
  for (let i = 14; i >= 1; i--) {
    const d = addDaysISO(today, -i);
    const v = byDay[d] ?? { active: 0, cancelled: 0 };
    days.push({ date: d, active: v.active, cancelled: v.cancelled });
  }

  // stabilitet / avvik:
  const actives = days.map((x) => x.active);
  const mean = avg(actives);
  const variance = actives.length ? avg(actives.map((x) => (x - mean) ** 2)) : 0;
  const std = Math.sqrt(variance);

  // normaliser “variation level” (enkel baseline)
  const cv = mean > 0 ? std / mean : 0; // coeff of variation
  const variationScore = clamp01(cv / 0.6); // 0..1 (0.6 = høy variasjon)
  const level = variationScore < 0.33 ? "lav" : variationScore < 0.66 ? "middels" : "høy";

  // “forventet i morgen”: bruk snitt for samme ukedag siste 4 uker hvis mulig (her: enkel baseline = mean)
  const forecast = Math.round(mean);

  // matsvinn-indikator (kun indikator):
  // høy cancelled-rate eller høy variasjon -> høyere risiko
  const cancelledTotal = days.reduce((a, b) => a + b.cancelled, 0);
  const activeTotal = days.reduce((a, b) => a + b.active, 0);
  const cancelRate = activeTotal > 0 ? cancelledTotal / (activeTotal + cancelledTotal) : 0;
  const wasteScore = clamp01(variationScore * 0.6 + cancelRate * 0.4);
  const wasteLevel = wasteScore < 0.33 ? "low" : wasteScore < 0.66 ? "medium" : "high";

  // varsler (rolig)
  const alerts: string[] = [];
  if (cancelRate > 0.25) alerts.push("Uvanlig mange avbestillinger siste 14 dager.");
  if (variationScore > 0.66) alerts.push("Stor variasjon i antall bestillinger siste 14 dager.");
  if (mean < 3) alerts.push("Få datapunkter – innsikt kan være mindre presis.");

  return NextResponse.json({
    ok: true,
    range: { from, to: today },
    forecast: { expectedTomorrow: forecast, confidence: mean >= 8 ? "high" : mean >= 4 ? "medium" : "low" },
    stability: { level, deviationPercent: Math.round(variationScore * 100) },
    waste: { level: wasteLevel, cancelRate: Math.round(cancelRate * 100) },
    series: days,
    alerts,
  });
}
