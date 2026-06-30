// app/api/week/route.ts
// Employee week: operativ sannhet = company_current_agreement + menuDay.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonOk, jsonErr } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { weekRangeISO } from "@/lib/date/week";
import { addDaysISO, osloNowParts, osloTodayISODate } from "@/lib/date/oslo";
import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import { opsLog } from "@/lib/ops/log";
import { fetchAgreementDayTiersForCompany } from "@/lib/agreement/currentAgreement";
import { buildEmployeeWeekDayRows } from "@/lib/week/employeeWeekMenuDays";
import { loadEmployeeWeekMenusFromMsdi } from "@/lib/week/loadEmployeeWeekMenusFromMsdi";
import { resolveEmployeeWeekScope } from "@/lib/week/resolveEmployeeWeekScope";
import { maybeRunWeekRuntimeCompatibilityHook } from "@/lib/menu-profile/weekRuntimeCompatibilityHook.server";
import { menuScopeDecision, menuDayQueryOptsFromScope, resolveProviderMenuScopeForCompany } from "@/lib/menu/providerMenuScope";
import type { MenuDay } from "@/lib/cms/menuDay";
import { asPlanTier } from "@/lib/cms/menuDayContract";
import { EMPLOYEE_WEEK_DAY_KEYS } from "@/lib/week/employeeWeekMenuDays";

type Tier = "BASIS" | "LUXUS" | "ENTERPRISE";
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";

type AgreementRow = {
  id?: string | null;
  company_id: string;
  status: "ACTIVE";
  plan_tier: Tier;
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
   - weekOffset=0: inneværende uke (Man–Fre) — kalender + menuDay
   - weekOffset=1: neste uke — låst til torsdag 08:00 Oslo (samme som order/window)
========================================================= */
export async function GET(req: Request) {
  const _rid = rid();

  try {
    const url = new URL(req.url || "http://localhost/api/week");
    const weekOffsetRaw = url.searchParams.get("weekOffset") ?? "0";
    const weekOffset = weekOffsetRaw === "1" ? 1 : 0;

    const scope = await resolveEmployeeWeekScope(req, _rid);
    if (scope.ok === false) return scope.response;

    const { companyId, locationId } = scope;
    const admin = supabaseAdmin();

    const { data: agr, error: agrErr } = await admin
      .from("agreements")
      .select("id,company_id,status,tier,delivery_days,starts_at,ends_at")
      .eq("company_id", companyId)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (agrErr) return jsonError(500, _rid, "AGREEMENT_LOOKUP_FAILED", "Kunne ikke hente avtale (fasit).", agrErr);
    if (!agr?.company_id) return jsonError(409, _rid, "NO_ACTIVE_AGREEMENT", "Firmaet mangler aktiv avtale. Kontakt admin.");

    const agreement = {
      id: (agr as any).id ?? null,
      company_id: (agr as any).company_id,
      status: (agr as any).status,
      plan_tier: (agr as any).tier,
      delivery_days: (agr as any).delivery_days,
      start_date: (agr as any).starts_at,
      end_date: (agr as any).ends_at,
    } as AgreementRow;
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

    const dayTiers = await fetchAgreementDayTiersForCompany(admin, companyId);
    const tierByDay = Object.keys(dayTiers).length > 0 ? dayTiers : null;

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

    // Provider-scope for menuDay (server truth: companies.provider_id → providers.slug).
    // fail-closed: provider finnes men kan ikke scopes trygt → ingen menuDay-henting.
    // Aldri en annen providers meny.
    const menuScope = menuScopeDecision(await resolveProviderMenuScopeForCompany(admin, companyId));
    if (menuScope.mode !== "scoped") {
      opsLog("week.menuScope", {
        rid: _rid,
        company_id: companyId,
        mode: menuScope.mode,
        reason: menuScope.mode === "fail-closed" ? menuScope.reason : null,
      });
    }

    const menuByDate = new Map<string, MenuDay[]>();
    let menuFetchFailed = false;
    try {
      if (menuScope.mode !== "fail-closed") {
        const { getMenuForDateAndPlan } = await import("@/lib/cms/menuDay");
        const menuDayOpts = menuDayQueryOptsFromScope(menuScope);
        for (let i = 0; i < dates.length; i += 1) {
          const date = dates[i];
          const dayKey = EMPLOYEE_WEEK_DAY_KEYS[i] ?? "mon";
          const tierForDay = asPlanTier(tierByDay?.[dayKey] ?? tier) ?? tier;
          const menus = await getMenuForDateAndPlan(date, tierForDay, menuDayOpts);
          if (menus.length > 0) menuByDate.set(date, menus);
        }
      }

      // MSDI fallback: when Sanity read misses but materialization exists (provider-scoped).
      if (menuScope.mode === "scoped") {
        const missingDates = dates.filter((d) => !menuByDate.has(d));
        if (missingDates.length > 0) {
          const tierByDate = new Map<string, "BASIS" | "LUXUS" | "ENTERPRISE">();
          for (let i = 0; i < dates.length; i += 1) {
            const date = dates[i];
            const dayKey = EMPLOYEE_WEEK_DAY_KEYS[i] ?? "mon";
            const tierForDay = asPlanTier(tierByDay?.[dayKey] ?? tier) ?? tier;
            tierByDate.set(date, tierForDay);
          }
          const msdiMenus = await loadEmployeeWeekMenusFromMsdi(admin, {
            companyId,
            locationId,
            providerId: menuScope.providerId,
            dates: missingDates,
            tierByDate,
          });
          for (const [date, menus] of msdiMenus) {
            if (!menuByDate.has(date) && menus.length > 0) menuByDate.set(date, menus);
          }
        }
      }
    } catch (e: unknown) {
      menuFetchFailed = true;
      const detail = String((e as { message?: string })?.message ?? e);
      opsLog("sanity.week.menu_fetch_failed", {
        rid: _rid,
        company_id: companyId,
        weekOffset,
        detail,
      });
    }

    const days = buildEmployeeWeekDayRows({
      dates,
      deliveryDayKeys: deliveryDays,
      defaultTier: tier,
      tierByDay,
      weekOffset,
      menuByDate,
    });

    maybeRunWeekRuntimeCompatibilityHook({ currentDays: days, rid: _rid, env: process.env });

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
        delivery_days: deliveryDays,
        /** Operativ tier per ukedag når daymap finnes (kilde for radene i `days`). */
        day_tiers: tierByDay ?? undefined,
        start_date: agreement.start_date,
        end_date: agreement.end_date,
      },
      sanity: {
        currentStatus: null,
        nextStatus: null,
        /** True når Sanity-kall feilet (meny ukjent — ikke synonymt med «ingen meny publisert»). */
        menuFetchFailed,
      },
      plan: null,
      days,
    });
  } catch (err: any) {
    console.error("[GET /api/week]", err?.message || err, err);
    return jsonError(500, _rid, "SERVER_ERROR", err?.message || String(err));
  }
}
