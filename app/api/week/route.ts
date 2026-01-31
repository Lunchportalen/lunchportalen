// app/api/weekplan/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

import { osloNowParts, osloTodayISODate } from "@/lib/date/oslo";

/* =========================================================
   Constants / types
========================================================= */
const WEEKDAYS_NO = ["Man", "Tir", "Ons", "Tor", "Fre"] as const;
type Tier = "BASIS" | "LUXUS";
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

type AgreementRow = {
  company_id: string;
  status: "ACTIVE";
  plan_tier: Tier;
  price_per_cuvert_nok: number;
  delivery_days: any; // jsonb array
  start_date: string;
  end_date: string | null;
};

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}

function rid(prefix = "weekplan") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function jsonError(status: number, rid: string, error: string, message?: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

function normalizeTier(v: any): Tier {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "LUXUS" ? "LUXUS" : "BASIS";
}

function normalizeDeliveryDays(v: any): DayKey[] {
  if (!v) return DAY_KEYS.slice();
  if (Array.isArray(v)) {
    const set = new Set<DayKey>();
    for (const x of v) {
      const s = String(x ?? "").trim().toLowerCase();
      if (DAY_KEYS.includes(s as DayKey)) set.add(s as DayKey);
    }
    return set.size ? Array.from(set) : DAY_KEYS.slice();
  }
  try {
    const parsed = typeof v === "string" ? JSON.parse(v) : v;
    if (Array.isArray(parsed)) return normalizeDeliveryDays(parsed);
  } catch {}
  return DAY_KEYS.slice();
}

/**
 * Torsdag 08:00 i inneværende uke låser opp neste uke i UI.
 * (Beholder dagens adferd – men “next” kommer også fra Sanity status=open.)
 */
function week2UnlockFromWeek0Monday(week0MondayISO: string) {
  // week0Monday + 3 = Thursday
  const unlockDateISO = addDaysISO(week0MondayISO, 3);
  const unlockTimeHM = "08:00";
  return { unlockDateISO, unlockTimeHM, unlockAt: `${unlockDateISO}T08:00` };
}

// Local copy (uten å importere mer enn nødvendig)
function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function startOfWeekISO(todayISO: string) {
  // ISO week start Monday in Oslo terms: we approximate by UTC noon and adjust by weekday.
  // Since todayISO comes from osloTodayISODate(), it's stable for Oslo date.
  const d = new Date(`${todayISO}T12:00:00.000Z`);
  // JS: 0=Sun..6=Sat. We need Monday=0..Sunday=6 offset.
  const js = d.getUTCDay(); // 0=Sun
  const offset = js === 0 ? 6 : js - 1; // Monday => 0, Tuesday =>1 ... Sunday=>6
  d.setUTCDate(d.getUTCDate() - offset);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function isUnlocked(unlockDateISO: string, unlockTimeHM: string) {
  const now = osloNowParts();
  const nowDateISO = `${now.yyyy}-${now.mm}-${now.dd}`;
  const nowTimeHM = `${String(now.hh).padStart(2, "0")}:${String(now.mi).padStart(2, "0")}`;

  if (nowDateISO < unlockDateISO) return false;
  if (nowDateISO > unlockDateISO) return true;
  return nowTimeHM >= unlockTimeHM;
}

/* =========================================================
   GET /api/weekplan
   - weekOffset=0: current week plan from Sanity (status=current)
   - weekOffset=1: next week from Sanity only if status=open AND after Thursday 08:00 unlock
   - Always returns 5 days, with isDeliveryDay per agreement
========================================================= */
export async function GET(req: Request) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { fetchCurrentWeekPlan, fetchNextOpenWeekPlan } = await import("@/lib/sanity/weekplan");
  const _rid = rid();

  try {
    const url = new URL(req.url);
    const weekOffsetRaw = url.searchParams.get("weekOffset") ?? "0";
    const weekOffset = weekOffsetRaw === "1" ? 1 : 0;

    // ✅ Auth + tenant-scope
    const sb = await supabaseServer();
    const { data: auth, error: aerr } = await sb.auth.getUser();
    const user = auth?.user ?? null;
    if (aerr || !user) return jsonError(401, _rid, "AUTH_REQUIRED", "Ikke innlogget.");

    const { data: prof, error: perr } = await sb
      .from("profiles")
      .select("company_id, location_id, role, is_active, disabled_at, disabled_reason")
      .eq("user_id", user.id)
      .maybeSingle();

    if (perr) return jsonError(500, _rid, "PROFILE_LOOKUP_FAILED", "Kunne ikke hente profil.", perr);
    if (!prof?.company_id) return jsonError(409, _rid, "MISSING_COMPANY", "Mangler firmatilknytning.");
    if (prof.disabled_at || prof.disabled_reason) return jsonError(403, _rid, "DISABLED", "Kontoen er deaktivert.");
    if (prof.is_active === false) return jsonError(403, _rid, "INACTIVE", "Kontoen er ikke aktiv ennå.");

    const companyId = String(prof.company_id);

    // ✅ ACTIVE avtale (fasit)
    const { data: agr, error: agrErr } = await sb
      .from("company_current_agreement")
      .select("company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, start_date, end_date")
      .eq("company_id", companyId)
      .maybeSingle();

    if (agrErr) return jsonError(500, _rid, "AGREEMENT_LOOKUP_FAILED", "Kunne ikke hente avtale (fasit).", agrErr);
    if (!agr?.company_id) return jsonError(409, _rid, "NO_ACTIVE_AGREEMENT", "Firmaet mangler aktiv avtale. Kontakt admin.");

    const agreement = agr as AgreementRow;
    const tier: Tier = normalizeTier(agreement.plan_tier);
    const deliveryDays = normalizeDeliveryDays(agreement.delivery_days);

    // 🔒 Cutoff fasit i systemet: 08:00 Oslo
    const cutoff = "08:00";

    // ✅ Unlock-info (for uke 1)
    const todayISO = osloTodayISODate();
    const week0MondayISO = startOfWeekISO(todayISO);
    const { unlockDateISO, unlockTimeHM, unlockAt } = week2UnlockFromWeek0Monday(week0MondayISO);

    // ✅ Sanity: current alltid
    const currentPlan = await fetchCurrentWeekPlan(todayISO);

    // ✅ Sanity: next kun hvis open
    const nextPlan = weekOffset === 1 ? await fetchNextOpenWeekPlan(todayISO) : null;

    // 🔒 UI-lås for ukeOffset=1 frem til torsdag 08:00 (uansett om next finnes)
    const lockedByTime = weekOffset === 1 ? !isUnlocked(unlockDateISO, unlockTimeHM) : false;

    // 🔒 I tillegg: hvis next ikke finnes/open, så er den effektivt låst/ikke tilgjengelig
    const lockedByAvailability = weekOffset === 1 ? !nextPlan : false;
    const locked = weekOffset === 1 ? (lockedByTime || lockedByAvailability) : false;

    const plan = weekOffset === 1 ? nextPlan : currentPlan;

    // Baseline days: alltid 5 dager
    // Hvis plan finnes fra Sanity, bruker vi plan.days[*].date til å fylle datoer.
    // Hvis plan mangler (f.eks. current ikke opprettet enda), faller vi tilbake til mandag->fredag.
    let dates: string[] = [];

    if (plan?.days && Array.isArray(plan.days) && plan.days.length === 5) {
      dates = plan.days.map((d: any) => String(d?.date ?? "")).filter(Boolean);
    }

    if (dates.length !== 5) {
      // fallback til kalenderberegning: uke 0 eller uke 1
      const mondayISO = addDaysISO(week0MondayISO, weekOffset * 7);
      dates = Array.from({ length: 5 }).map((_, i) => addDaysISO(mondayISO, i));
    }

    const days = dates.map((date, i) => {
      const dayKey = DAY_KEYS[i];
      const isDeliveryDay = deliveryDays.includes(dayKey);

      // Ved plan: prøv å hente nivå og retter (ikke brytende)
      const pDay = plan?.days?.[i] ?? null;

      return {
        date,
        weekday: WEEKDAYS_NO[i],
        dayKey,
        tier: (pDay?.level === "LUXUS" ? "LUXUS" : pDay?.level === "BASIS" ? "BASIS" : tier) as Tier,
        isDeliveryDay,

        // Sanity-innhold (ikke brytende)
        dishes: Array.isArray(pDay?.dishes) ? pDay.dishes : [],
        kitchenNote: pDay?.kitchenNote ?? null,

        // Status/meta
        weekOffset,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        rid: _rid,
        today: todayISO,
        weekOffset,
        locked,
        unlockAt,
        cutoff,
        agreement: {
          companyId,
          plan_tier: tier,
          price_per_cuvert_nok: agreement.price_per_cuvert_nok,
          delivery_days: deliveryDays,
          start_date: agreement.start_date,
          end_date: agreement.end_date,
        },
        sanity: {
          currentStatus: currentPlan?.status ?? null,
          nextStatus: nextPlan?.status ?? null,
        },
        plan: plan ?? null,
        days,
      },
      { headers: noStore() }
    );
  } catch (err: any) {
    console.error("[GET /api/weekplan]", err?.message || err, err);
    return jsonError(500, _rid, "SERVER_ERROR", err?.message || String(err));
  }
}


