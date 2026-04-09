// app/api/week/route.ts
// Employee week: operativ sannhet = company_current_agreement + menuContent (ingen Sanity weekPlan).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonOk, jsonErr } from "@/lib/http/respond";

import { weekRangeISO } from "@/lib/date/week";
import { addDaysISO, osloNowParts, osloTodayISODate } from "@/lib/date/oslo";
import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import { opsLog } from "@/lib/ops/log";
import { buildEmployeeWeekDayRows } from "@/lib/week/employeeWeekMenuDays";
import type { MenuContent } from "@/lib/sanity/queries";

type Tier = "BASIS" | "LUXUS";
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";

type AgreementRow = {
  company_id: string;
  status: "ACTIVE";
  plan_tier: Tier;
  price_per_cuvert_nok: number;
  delivery_days: any;
  start_date: string;
  end_date: string | null;
};

function rid(prefix = "week_api") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function jsonError(status: number, rid: string, error: string, message?: string, _detail?: unknown) {
  return jsonErr(rid, message || "Ukjent feil", status, error);
}

function normalizeTier(v: any): Tier {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "LUXUS" ? "LUXUS" : "BASIS";
}

function logDeliveryDaysWarning(args: {
  rid: string;
  company_id: string;
  agreement_id?: string | null;
  raw: any;
  unknown: string[];
  days: string[];
}) {
  if (!args.unknown.length) return;
  opsLog("agreement.delivery_days.warning", {
    rid: args.rid,
    company_id: args.company_id,
    agreement_id: args.agreement_id ?? null,
    unknown: args.unknown,
    days: args.days,
    raw: args.raw ?? null,
  });
}

function week2UnlockFromWeek0Monday(week0MondayISO: string) {
  const unlockDateISO = addDaysISO(week0MondayISO, 3);
  const unlockTimeHM = "08:00";
  return { unlockDateISO, unlockTimeHM, unlockAt: `${unlockDateISO}T08:00` };
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
   GET /api/week
   - weekOffset=0: inneværende uke (Man–Fre) — kalender + menuContent
   - weekOffset=1: neste uke — låst til torsdag 08:00 Oslo (samme som order/window)
========================================================= */
export async function GET(req: Request) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const _rid = rid();

  try {
    const url = new URL(req.url || "http://localhost/api/week");
    const weekOffsetRaw = url.searchParams.get("weekOffset") ?? "0";
    const weekOffset = weekOffsetRaw === "1" ? 1 : 0;

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

    const { data: agr, error: agrErr } = await sb
      .from("company_current_agreement")
      .select("company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, start_date, end_date")
      .eq("company_id", companyId)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (agrErr) return jsonError(500, _rid, "AGREEMENT_LOOKUP_FAILED", "Kunne ikke hente avtale (fasit).", agrErr);
    if (!agr?.company_id) return jsonError(409, _rid, "NO_ACTIVE_AGREEMENT", "Firmaet mangler aktiv avtale. Kontakt admin.");

    const agreement = agr as AgreementRow;
    const tier: Tier = normalizeTier(agreement.plan_tier);
    const deliveryNorm = normalizeDeliveryDaysStrict(agreement.delivery_days);
    logDeliveryDaysWarning({
      rid: _rid,
      company_id: companyId,
      agreement_id: (agreement as any)?.id ?? null,
      raw: agreement.delivery_days ?? null,
      unknown: deliveryNorm.unknown,
      days: deliveryNorm.days,
    });
    const deliveryDays = deliveryNorm.days as DayKey[];

    const cutoff = "08:00";

    const todayISO = osloTodayISODate();
    const week0MondayISO = weekRangeISO(0)[0] ?? todayISO;
    const { unlockDateISO, unlockTimeHM, unlockAt } = week2UnlockFromWeek0Monday(week0MondayISO);

    const lockedByTime = weekOffset === 1 ? !isUnlocked(unlockDateISO, unlockTimeHM) : false;
    const locked = weekOffset === 1 ? lockedByTime : false;

    const dates = weekRangeISO(weekOffset);
    if (dates.length !== 5) {
      return jsonError(500, _rid, "WEEK_RANGE_INVALID", "Ugyldig ukeintervall.");
    }

    const menuByDate = new Map<string, MenuContent>();
    try {
      const { getMenuForDates } = await import("@/lib/cms/menuContent");
      const menus = await getMenuForDates(dates);
      for (const m of menus ?? []) {
        const dt = String((m as MenuContent).date ?? "").slice(0, 10);
        if (dt) menuByDate.set(dt, m as MenuContent);
      }
    } catch (e: unknown) {
      console.warn("[GET /api/week] getMenuForDates failed", String((e as { message?: string })?.message ?? e));
    }

    const days = buildEmployeeWeekDayRows({
      dates,
      deliveryDayKeys: deliveryDays,
      defaultTier: tier,
      weekOffset,
      menuByDate,
    });

    const rangeFrom = dates[0] ?? "";
    const rangeTo = dates[dates.length - 1] ?? "";

    return jsonOk(_rid, {
      ok: true,
      weekOffset,
      range: { from: rangeFrom, to: rangeTo },
      today: todayISO,
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
        currentStatus: null,
        nextStatus: null,
        weekPlanOperational: false,
      },
      plan: null,
      days,
    });
  } catch (err: any) {
    console.error("[GET /api/week]", err?.message || err, err);
    return jsonError(500, _rid, "SERVER_ERROR", err?.message || String(err));
  }
}
