// GET /api/admin/demand-insights — additiv «AI Innsikt» for company_admin (samme scope som ROI-innsikt).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
import type { WeekdayKeyMonFri } from "@/lib/date/weekdayKeyFromIso";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { scopeOr401, requireRoleOr403, resolveAdminTenantCompanyId, q } from "@/lib/http/routeGuard";
import { auditAdmin } from "@/lib/audit/actions";
import { aggregateOrdersByDate, type OrderRowForDemand } from "@/lib/ai/demandData";
import { forecastDemandV1 } from "@/lib/ai/demandEngine";
import {
  buildAdminSuggestionLines,
  signalsFromChoiceCounts,
  weekdayActiveAverages,
} from "@/lib/ai/demandInsights";
import { parseMealContractFromAgreementJson } from "@/lib/server/agreements/mealContract";
import { rollupWasteMetrics, wastePercentForDay } from "@/lib/ai/wasteTracker";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function deliverySetFromAgreement(agreementJson: unknown): Set<WeekdayKeyMonFri> | null {
  const c = parseMealContractFromAgreementJson(agreementJson);
  if (!c?.delivery_days?.length) return null;
  return new Set(c.delivery_days as WeekdayKeyMonFri[]);
}

export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.demand_insights.read", ["company_admin"]);
  if (denyRole) return denyRole;

  const tenant = resolveAdminTenantCompanyId(a.ctx, req);
  if (tenant.ok === false) return tenant.res;
  const companyId = tenant.companyId;
  const actorUserId = safeStr(scope.userId);
  const actorEmail = scope.email ?? null;
  const locationId = scope.locationId ?? null;

  const days = Math.min(90, Math.max(14, Number(q(req, "days")) || 56));
  const today = osloTodayISODate();
  const from = addDaysISO(today, -(days - 1));

  const admin = supabaseAdmin();

  try {
    let ordersQ = admin
      .from("orders")
      .select("date,status,created_at,updated_at,location_id")
      .eq("company_id", companyId)
      .gte("date", from)
      .lte("date", today);

    if (locationId) {
      ordersQ = ordersQ.eq("location_id", locationId);
    }

    const ordersRes = await ordersQ;

    if (ordersRes.error) {
      return jsonErr(rid, "Kunne ikke hente ordredata.", 500, { code: "ORDERS_FETCH_FAILED", detail: ordersRes.error });
    }

    const rows = (ordersRes.data ?? []) as OrderRowForDemand[];
    const map = aggregateOrdersByDate(rows);
    const history = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));

    const { data: comp } = await admin.from("companies").select("agreement_json").eq("id", companyId).maybeSingle();
    const deliveryWeekdays = comp?.agreement_json != null ? deliverySetFromAgreement(comp.agreement_json) : null;

    const ranked = weekdayActiveAverages(history);

    let dcQuery = admin
      .from("day_choices")
      .select("choice_key")
      .eq("company_id", companyId)
      .gte("date", from)
      .lte("date", today);
    if (locationId) dcQuery = dcQuery.eq("location_id", locationId);
    const dcRes = await dcQuery;

    const choiceMap = new Map<string, number>();
    if (!dcRes.error) {
      for (const r of (dcRes.data ?? []) as { choice_key?: string | null }[]) {
        const k = safeStr(r.choice_key).toLowerCase();
        if (!k) continue;
        choiceMap.set(k, (choiceMap.get(k) ?? 0) + 1);
      }
    }
    const choiceRows = [...choiceMap.entries()].map(([choice_key, count]) => ({ choice_key, count }));
    const dishSignals = signalsFromChoiceCounts(choiceRows);
    const suggestions = buildAdminSuggestionLines(ranked, dishSignals);

    const nextTarget = (() => {
      let cur = addDaysISO(today, 1);
      for (let i = 0; i < 14; i++) {
        const w = new Date(`${cur}T12:00:00+01:00`).getDay();
        if (w !== 0 && w !== 6) return cur;
        cur = addDaysISO(cur, 1);
      }
      return addDaysISO(today, 1);
    })();

    const nextForecast = forecastDemandV1({
      targetDate: nextTarget,
      history,
      deliveryWeekdays: deliveryWeekdays ?? undefined,
    });

    const wasteDays = history.slice(-14).map((h) => ({
      date: h.date,
      produced: null as number | null,
      consumed: h.activeCount,
    }));
    const wasteRollup = rollupWasteMetrics(wasteDays);
    const wasteExamples = history.slice(-5).map((h) => wastePercentForDay({ date: h.date, produced: null, consumed: h.activeCount }));

    const data = {
      transparencyNote: "Basert på historiske bestillinger",
      window: { from, to: today, days },
      weekdayRanking: ranked,
      dishSignals,
      suggestions,
      nextBusinessDayForecast: {
        date: nextForecast.date,
        predictedOrders: nextForecast.predictedOrders,
        confidence: nextForecast.confidence,
        marginOfError: nextForecast.marginOfError,
        plannedWithBuffer: nextForecast.plannedWithBuffer,
        bufferPercent: nextForecast.bufferPercent,
        explanation: nextForecast.explanation,
      },
      waste: {
        rollup: wasteRollup,
        note:
          wasteRollup.daysWithData === 0
            ? "Full svinnanalyse krever registrert produsert antall per dag (ikke tilgjengelig i V1)."
            : wasteRollup.transparencyNote,
      },
    };

    await auditAdmin({
      actor_user_id: actorUserId,
      actor_email: actorEmail,
      action: "admin.demand_insights.read",
      company_id: companyId,
      location_id: locationId,
      meta: { rid, from, to: today, days, nextTarget },
    });

    return jsonOk(rid, data, 200);
  } catch (e: unknown) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String((e as Error)?.message ?? e) } });
  }
  });
}
