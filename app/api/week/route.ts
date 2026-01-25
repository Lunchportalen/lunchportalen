// app/api/week/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 30;

import { NextResponse } from "next/server";
import { getMenuForRange } from "@/lib/sanity/queries";
import { addDaysISO, osloNowParts, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { supabaseServer } from "@/lib/supabase/server";

const WEEKDAYS_NO = ["Man", "Tir", "Ons", "Tor", "Fre"] as const;

type Tier = "BASIS" | "LUXUS";
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}

function jsonError(status: number, rid: string, error: string, message?: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

function clampWeekOffset(v: any): 0 | 1 {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return (Math.max(0, Math.min(1, n)) as 0 | 1) ?? 0;
}

function week2UnlockFromWeek0Monday(week0MondayISO: string) {
  const unlockDateISO = addDaysISO(week0MondayISO, 3); // Thursday
  const unlockTimeHM = "08:00";
  return {
    unlockDateISO,
    unlockTimeHM,
    unlockAt: `${unlockDateISO}T08:00`,
  };
}

function isUnlocked(unlockDateISO: string, unlockTimeHM: string) {
  const now = osloNowParts();
  const nowDateISO = `${now.yyyy}-${now.mm}-${now.dd}`;
  const nowTimeHM = `${String(now.hh).padStart(2, "0")}:${String(now.mi).padStart(2, "0")}`;

  if (nowDateISO < unlockDateISO) return false;
  if (nowDateISO > unlockDateISO) return true;
  return nowTimeHM >= unlockTimeHM;
}

function normalizeTier(v: any): Tier {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "LUXUS" ? "LUXUS" : "BASIS";
}

function normalizeDeliveryDays(v: any): DayKey[] {
  // delivery_days lagres som jsonb array: ["mon","tue",...]
  if (!v) return DAY_KEYS.slice();
  if (Array.isArray(v)) {
    const set = new Set<DayKey>();
    for (const x of v) {
      const s = String(x ?? "").trim().toLowerCase();
      if (DAY_KEYS.includes(s as DayKey)) set.add(s as DayKey);
    }
    return set.size ? Array.from(set) : DAY_KEYS.slice();
  }
  // Supabase kan gi jsonb som objekt/string i rare tilfeller – håndter robust
  try {
    const parsed = typeof v === "string" ? JSON.parse(v) : v;
    if (Array.isArray(parsed)) return normalizeDeliveryDays(parsed);
  } catch {}
  return DAY_KEYS.slice();
}

type AgreementRow = {
  company_id: string;
  status: "ACTIVE";
  plan_tier: Tier;
  price_per_cuvert_nok: number;
  delivery_days: any; // jsonb
  start_date: string;
  end_date: string | null;
};

export async function GET(req: Request) {
  const rid = `week_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const url = new URL(req.url);
    const weekOffset = clampWeekOffset(url.searchParams.get("weekOffset") ?? "0");

    // ✅ Auth + hent company_id (tenant-lås)
    const sb = await supabaseServer();
    const { data: auth, error: aerr } = await sb.auth.getUser();
    const user = auth?.user ?? null;
    if (aerr || !user) return jsonError(401, rid, "AUTH_REQUIRED", "Ikke innlogget.");

    const { data: prof, error: perr } = await sb
      .from("profiles")
      .select("company_id, location_id, role, is_active, disabled_at, disabled_reason")
      .eq("user_id", user.id)
      .maybeSingle();

    if (perr) return jsonError(500, rid, "PROFILE_LOOKUP_FAILED", "Kunne ikke hente profil.", perr);
    if (!prof?.company_id) return jsonError(409, rid, "MISSING_COMPANY", "Mangler firmatilknytning.");
    if (prof.disabled_at || prof.disabled_reason) return jsonError(403, rid, "DISABLED", "Kontoen er deaktivert.");
    if (prof.is_active === false) return jsonError(403, rid, "INACTIVE", "Kontoen er ikke aktiv ennå.");

    const companyId = String(prof.company_id);

    // ✅ FASIT: Hent ACTIVE avtale fra company_agreements (helst view: company_current_agreement)
    // NB: Dere kan bytte "company_current_agreement" til "company_agreements" hvis dere ikke bruker view.
    const { data: agr, error: agrErr } = await sb
      .from("company_current_agreement")
      .select("company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, start_date, end_date")
      .eq("company_id", companyId)
      .maybeSingle();

    if (agrErr) return jsonError(500, rid, "AGREEMENT_LOOKUP_FAILED", "Kunne ikke hente avtale (fasit).", agrErr);

    // 🔒 Ingen fallback: uten ACTIVE avtale er firma ikke “aktivt” i portalen
    if (!agr?.company_id) {
      return jsonError(
        409,
        rid,
        "NO_ACTIVE_AGREEMENT",
        "Firmaet mangler aktiv avtale. Kontakt admin."
      );
    }

    const agreement = agr as AgreementRow;
    const tier: Tier = normalizeTier(agreement.plan_tier);
    const deliveryDays = normalizeDeliveryDays(agreement.delivery_days);

    // 🔒 Cutoff er fasit i systemet (masterplan): 08:00 Oslo
    const cutoff = "08:00";

    // ✅ Finn mandag for uke 0 (inneværende uke) i Oslo
    const todayISO = osloTodayISODate();
    const week0MondayISO = startOfWeekISO(todayISO);

    // ✅ Beregn mandag/fredag for ønsket uke (0 eller 1)
    const mondayISO = addDaysISO(week0MondayISO, weekOffset * 7);
    const fridayISO = addDaysISO(mondayISO, 4);

    // 🔒 Lås weekOffset=1 frem til torsdag 08:00 i uke 0
    const { unlockDateISO, unlockTimeHM, unlockAt } = week2UnlockFromWeek0Monday(week0MondayISO);
    const locked = weekOffset === 1 ? !isUnlocked(unlockDateISO, unlockTimeHM) : false;

    // ✅ Vi returnerer alltid man–fre (5 dager), men markerer hvilke som er leveringsdager iht avtale.
    const baseDays = Array.from({ length: 5 }).map((_, i) => {
      const date = addDaysISO(mondayISO, i);
      const dayKey = DAY_KEYS[i];
      const isDeliveryDay = deliveryDays.includes(dayKey);

      return {
        date,
        weekday: WEEKDAYS_NO[i],
        dayKey,
        tier, // samme tier for alle dager (per dagens avtalestruktur)
        isDeliveryDay, // nytt felt (ikke-brytende)
        isPublished: false,
        description: null as string | null,
        allergens: [] as string[],
      };
    });

    if (locked) {
      return NextResponse.json(
        {
          ok: true,
          rid,
          range: { from: mondayISO, to: fridayISO },
          weekOffset,
          locked: true,
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
          days: baseDays,
        },
        { headers: noStore() }
      );
    }

    // ✅ Hent menyinnhold når ikke låst
    const items = await getMenuForRange(mondayISO, fridayISO);
    const byDate = new Map<string, any>();
    for (const it of items || []) byDate.set(it.date, it);

    const days = baseDays.map((d) => {
      const it = byDate.get(d.date);
      return {
        ...d,
        isPublished: !!it?.isPublished,
        description: it?.description ?? null,
        allergens: it?.allergens ?? [],
      };
    });

    return NextResponse.json(
      {
        ok: true,
        rid,
        range: { from: mondayISO, to: fridayISO },
        weekOffset,
        locked: false,
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
        days,
      },
      { headers: noStore() }
    );
  } catch (err: any) {
    console.error("[GET /api/week]", err?.message || err, err);
    return jsonError(500, rid, "SERVER_ERROR", err?.message || String(err));
  }
}
