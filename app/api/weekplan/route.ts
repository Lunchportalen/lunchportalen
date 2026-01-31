// app/api/weekplan/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

const OSLO_TZ = "Europe/Oslo";

type Tier = "BASIS" | "LUXUS";
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}

function json(status: number, body: any) {
  return NextResponse.json(body, { status, headers: noStore() });
}

function todayOsloISODate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: OSLO_TZ }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`; // ISO YYYY-MM-DD
}

function normalizeTier(v: any): Tier {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "LUXUS" ? "LUXUS" : "BASIS";
}

function defaultWeekPattern(): Record<DayKey, Tier> {
  return { mon: "BASIS", tue: "BASIS", wed: "BASIS", thu: "BASIS", fri: "LUXUS" };
}

export async function GET() {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { fetchNextPublishedWeekPlan } = await import("@/lib/sanity/weekplan");
  const rid = `weekplan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // 1) Auth + company scope
  const sb = await supabaseServer();
  const { data: auth, error: aerr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (aerr || !user) return json(401, { ok: false, rid, error: "AUTH_REQUIRED", message: "Ikke innlogget." });

  const { data: prof, error: perr } = await sb
    .from("profiles")
    .select("company_id, location_id, role, is_active, disabled_at, disabled_reason")
    .eq("user_id", user.id)
    .maybeSingle();

  if (perr) return json(500, { ok: false, rid, error: "PROFILE_LOOKUP_FAILED", message: "Kunne ikke hente profil.", detail: perr });
  if (!prof?.company_id) return json(409, { ok: false, rid, error: "MISSING_COMPANY", message: "Mangler firmatilknytning." });
  if (prof.disabled_at || prof.disabled_reason) return json(403, { ok: false, rid, error: "DISABLED", message: "Kontoen er deaktivert." });
  if (prof.is_active === false) return json(403, { ok: false, rid, error: "INACTIVE", message: "Kontoen er ikke aktiv ennå." });

  const companyId = String(prof.company_id);

  // 2) Agreement (companies.agreement_json)
  const { data: comp, error: cerr } = await sb.from("companies").select("id, agreement_json").eq("id", companyId).maybeSingle();
  if (cerr) return json(500, { ok: false, rid, error: "COMPANY_LOOKUP_FAILED", message: "Kunne ikke hente firma.", detail: cerr });

  const agreement = (comp as any)?.agreement_json ?? null;

  const week_pattern_raw = agreement?.week_pattern ?? agreement?.weekPattern ?? null;
  const pattern: Record<DayKey, Tier> = defaultWeekPattern();

  if (week_pattern_raw && typeof week_pattern_raw === "object") {
    for (const k of DAY_KEYS) {
      if (k in week_pattern_raw) pattern[k] = normalizeTier((week_pattern_raw as any)[k]);
    }
  }

  const cutoff = String(agreement?.cutoff ?? agreement?.cutoff_time ?? "08:00");
  const prices = agreement?.prices ?? null;

  // 3) Sanity weekplan (som før)
  const today = todayOsloISODate();
  const plan = await fetchNextPublishedWeekPlan(today);

  return json(200, {
    ok: true,
    rid,
    today,
    companyId,
    agreement: {
      cutoff,
      week_pattern: pattern,
      prices,
    },
    plan,
  });
}



