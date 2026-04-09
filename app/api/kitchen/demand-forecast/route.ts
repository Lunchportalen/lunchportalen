// GET /api/kitchen/demand-forecast — additiv prognose for kjøkken (ingen endring i eksisterende kjøkken-API).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
import type { WeekdayKeyMonFri } from "@/lib/date/weekdayKeyFromIso";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { aggregateOrdersByDate, type OrderRowForDemand } from "@/lib/ai/demandData";
import { forecastDemandV1, type DemandForecastOutput } from "@/lib/ai/demandEngine";
import { parseMealContractFromAgreementJson } from "@/lib/server/agreements/mealContract";

const allowedRoles = ["kitchen", "superadmin"] as const;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function isUuid(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
}

function isWeekendISO(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00+01:00`);
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function nextBusinessDayISO(fromISO: string): string {
  let cur = addDaysISO(fromISO, 1);
  for (let i = 0; i < 14; i++) {
    if (!isWeekendISO(cur)) return cur;
    cur = addDaysISO(cur, 1);
  }
  return cur;
}

function deliverySetFromAgreement(agreementJson: unknown): Set<WeekdayKeyMonFri> | null {
  const c = parseMealContractFromAgreementJson(agreementJson);
  if (!c?.delivery_days?.length) return null;
  return new Set(c.delivery_days as WeekdayKeyMonFri[]);
}

export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s = await scopeOr401(req);
  if (s.ok === false) return s.res;

  const { rid, scope } = s.ctx;
  const roleBlock = requireRoleOr403(s.ctx, scope.role ?? null, allowedRoles);
  if (roleBlock) return roleBlock;

  const u = new URL(req.url);
  const forDateParam = safeStr(u.searchParams.get("forDate"));
  const today = osloTodayISODate();
  const forDate = forDateParam && isISODate(forDateParam) ? forDateParam : nextBusinessDayISO(today);

  const role = safeStr(scope?.role).toLowerCase();
  let companyId = safeStr(scope?.companyId);
  let locationId = safeStr(scope?.locationId);

  if (role === "superadmin") {
    companyId = safeStr(u.searchParams.get("company_id")) || safeStr(u.searchParams.get("companyId"));
    locationId = safeStr(u.searchParams.get("location_id")) || safeStr(u.searchParams.get("locationId"));
    if (!isUuid(companyId) || !isUuid(locationId)) {
      return jsonErr(
        rid,
        "Superadmin må oppgi company_id og location_id (UUID) for prognose — unngår kryss-firma aggregering.",
        400,
        "FORECAST_SCOPE_REQUIRED",
        { detail: { companyIdOk: isUuid(companyId), locationIdOk: isUuid(locationId) } },
      );
    }
  }

  if (role === "kitchen" && (!isUuid(companyId) || !isUuid(locationId))) {
    return jsonErr(rid, "Scope er ikke tilordnet.", 403, "SCOPE_NOT_ASSIGNED", {
      companyIdPresent: Boolean(companyId),
      locationIdPresent: Boolean(locationId),
    });
  }

  const admin = supabaseAdmin();

  const from = addDaysISO(forDate, -56);
  const to = addDaysISO(forDate, -1);

  const { data: orderRows, error: oErr } = await admin
    .from("orders")
    .select("date,status,created_at,updated_at")
    .eq("company_id", companyId)
    .eq("location_id", locationId)
    .gte("date", from)
    .lte("date", to);

  if (oErr) {
    return jsonErr(rid, "Kunne ikke hente historikk for prognose.", 500, {
      code: "ORDERS_FETCH_FAILED",
      detail: oErr,
    });
  }

  const rows = (orderRows ?? []) as OrderRowForDemand[];
  const map = aggregateOrdersByDate(rows);
  const history = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));

  let deliveryWeekdays: Set<WeekdayKeyMonFri> | null = null;
  const { data: comp } = await admin.from("companies").select("agreement_json").eq("id", companyId).maybeSingle();
  if (comp?.agreement_json != null) {
    deliveryWeekdays = deliverySetFromAgreement(comp.agreement_json);
  }

  let companyEmployeeCount: number | null = null;
  const empRes = await admin
    .from("profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("role", "employee")
    .is("disabled_at", null);
  if (!empRes.error && typeof empRes.count === "number") {
    companyEmployeeCount = empRes.count;
  }

  const forecast: DemandForecastOutput = forecastDemandV1({
    targetDate: forDate,
    history,
    deliveryWeekdays: deliveryWeekdays ?? undefined,
    companyEmployeeCount,
  });

  const yesterday = addDaysISO(forDate, -1);
  const actualYesterday = map.get(yesterday);
  const feedback =
    actualYesterday != null
      ? {
          date: yesterday,
          actualActive: actualYesterday.activeCount,
          errorVersusPriorModelNote:
            "Avvik mot tidligere prognose lagres ikke separat — neste kjøring leser oppdatert faktisk historikk automatisk.",
        }
      : null;

  return jsonOk(
    rid,
    {
      forDate,
      historyFrom: from,
      historyTo: to,
      forecast,
      feedback,
      reversibleNote:
        "Prognosen er kun visning — den endrer ikke bestillinger, menyer eller produksjonsdata. Slå av ved å skjule panelet (ingen servertilstand).",
    },
    200,
  );
  });
}
