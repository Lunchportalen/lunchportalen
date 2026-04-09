// GET/POST /api/admin/operations-tower — additiv supply-chain oversikt (kun forslag, ingen auto-kjøring).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
import type { WeekdayKeyMonFri } from "@/lib/date/weekdayKeyFromIso";
import { aggregateOrdersByDate, type OrderRowForDemand } from "@/lib/ai/demandData";
import { forecastDemandV1 } from "@/lib/ai/demandEngine";
import { signalsFromChoiceCounts } from "@/lib/ai/demandInsights";
import { buildProcurementPlan } from "@/lib/ai/procurementEngine";
import { buildPurchaseSuggestions } from "@/lib/ai/purchasePlanner";
import { suggestSupplierLines } from "@/lib/ai/supplierPlanner";
import { buildProductionSchedule } from "@/lib/ai/productionPlanner";
import { planRouteOrder, type RouteStopInput } from "@/lib/ai/routePlanner";
import { allocatePortionsProportional } from "@/lib/ai/portionAllocation";
import { hindcastLastDeliveryDay } from "@/lib/ai/operationsFeedback";
import { buildCostOptimizationLines } from "@/lib/ai/costOptimizationEngine";
import { allCatalogMenuKeys } from "@/lib/ai/menuToIngredients";
import { composeOperationsAutonomy } from "@/lib/ai/composeOperationsAutonomy";
import { composeGlobalOsSnapshot } from "@/lib/ai/composeGlobalOs";
import { parseMealContractFromAgreementJson } from "@/lib/server/agreements/mealContract";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";
import { auditAdmin } from "@/lib/audit/actions";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function deliverySetFromAgreement(agreementJson: unknown): Set<WeekdayKeyMonFri> | null {
  const c = parseMealContractFromAgreementJson(agreementJson);
  if (!c?.delivery_days?.length) return null;
  return new Set(c.delivery_days as WeekdayKeyMonFri[]);
}

function nextBusinessDayFrom(iso: string): string {
  let cur = addDaysISO(iso, 1);
  for (let i = 0; i < 14; i++) {
    const w = new Date(`${cur}T12:00:00+01:00`).getDay();
    if (w !== 0 && w !== 6) return cur;
    cur = addDaysISO(cur, 1);
  }
  return addDaysISO(iso, 1);
}

function lastBusinessDayOnOrBefore(iso: string): string {
  let cur = iso;
  for (let i = 0; i < 10; i++) {
    const w = new Date(`${cur}T12:00:00+01:00`).getDay();
    if (w !== 0 && w !== 6) return cur;
    cur = addDaysISO(cur, -1);
  }
  return iso;
}

async function buildPayload(
  rid: string,
  companyId: string,
  locationId: string | null,
  actorUserId: string,
  actorEmail: string | null,
  autonomyQuery: string | null,
) {
  const today = osloTodayISODate();
  const from = addDaysISO(today, -55);
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin();

  let ordersQ = admin
    .from("orders")
    .select("date,status,created_at,updated_at,location_id")
    .eq("company_id", companyId)
    .gte("date", from)
    .lte("date", today);

  if (locationId) ordersQ = ordersQ.eq("location_id", locationId);

  const ordersRes = await ordersQ;
  if (ordersRes.error) {
    return { error: ordersRes.error as unknown };
  }

  const rows = (ordersRes.data ?? []) as OrderRowForDemand[];
  const map = aggregateOrdersByDate(rows);
  const history = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));

  const { data: comp } = await admin
    .from("companies")
    .select("agreement_json,price_per_portion_ex_vat")
    .eq("id", companyId)
    .maybeSingle();
  const deliveryWeekdays = comp?.agreement_json != null ? deliverySetFromAgreement(comp.agreement_json) : null;

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

  const nextTarget = nextBusinessDayFrom(today);
  const nextForecast = forecastDemandV1({
    targetDate: nextTarget,
    history,
    deliveryWeekdays: deliveryWeekdays ?? undefined,
  });

  const weights = new Map(choiceMap);
  if (weights.size === 0 && nextForecast.predictedOrders > 0) {
    for (const k of allCatalogMenuKeys().slice(0, 4)) {
      weights.set(k, 1);
    }
  }

  const allocations = allocatePortionsProportional(nextForecast.predictedOrders, weights);

  const procurement = buildProcurementPlan({
    portionsByMenu: allocations,
    bufferPercent: nextForecast.bufferPercent,
  });

  const purchase = buildPurchaseSuggestions(procurement.lines);
  const supplierLines = suggestSupplierLines(procurement.lines.map((l) => l.ingredient));

  const sortedMenus = Object.entries(allocations)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  const production = buildProductionSchedule({
    targetDate: nextTarget,
    totalPortions: nextForecast.predictedOrders,
    dominantMenus: sortedMenus,
  });

  let locQ = admin
    .from("company_locations")
    .select("id,name,city")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  if (locationId) locQ = locQ.eq("id", locationId);
  const locRes = await locQ;
  const locRows = (locRes.data ?? []) as { id: string; name: string | null; city: string | null }[];

  const stops: RouteStopInput[] = locRows.map((l) => ({
    id: safeStr(l.id),
    name: safeStr(l.name) || "Lokasjon",
    windowStart: "08:00",
    windowEnd: "10:00",
  }));

  const route = planRouteOrder(stops);

  const evalDay = lastBusinessDayOnOrBefore(addDaysISO(today, -1));
  const feedback = hindcastLastDeliveryDay({
    evaluationDate: evalDay,
    history,
    deliveryWeekdays: deliveryWeekdays ?? undefined,
  });

  const ordersLast7 = history.filter((h) => h.date >= addDaysISO(today, -6));
  const sum7 = ordersLast7.reduce((s, h) => s + h.activeCount, 0);
  const activeDays7 = ordersLast7.filter((h) => h.activeCount > 0).length;
  const weeklyPortionsEstimate = activeDays7 > 0 ? Math.round((sum7 / activeDays7) * 5) : sum7;

  const cost = buildCostOptimizationLines(
    dishSignals.map((d) => ({ choiceKey: d.choiceKey, signal: d.signal })),
    weeklyPortionsEstimate,
  );

  const priceExVatRaw = (comp as { price_per_portion_ex_vat?: unknown } | null)?.price_per_portion_ex_vat;
  const currentPriceExVat =
    priceExVatRaw != null && Number.isFinite(Number(priceExVatRaw)) ? Number(priceExVatRaw) : null;

  const ai = composeOperationsAutonomy({
    history,
    dishSignals,
    nextForecast,
    hindcastAbsError: feedback ? Math.abs(feedback.error) : null,
    procurementLines: procurement.lines,
    locationCount: locRows.length,
    weeklyPortionsEstimate,
    currentPriceExVat,
    deliveryWeekdays,
    requestedAutonomy: autonomyQuery,
  });

  const globalOs = composeGlobalOsSnapshot({
    snapshotAsOf: today,
    companyId,
    rows,
    locations: locRows.map((l) => ({
      id: safeStr(l.id),
      name: safeStr(l.name) || "Lokasjon",
      city: safeStr(l.city),
    })),
    history,
    nextForecastPortions: nextForecast.predictedOrders,
    procurementLines: procurement.lines,
    routeOrdered: route.ordered,
    hindcastError: feedback ? Math.abs(feedback.error) : null,
    currentPriceExVat,
    weeklyPortionsEstimate,
    dishSignals,
  });

  const data = {
    planRid: rid,
    autonomyLevel: ai.autonomy.level,
    transparencyRoot: [
      ...ai.autonomy.transparency,
      "Ingen bestilling, menyendring, prisendring eller leveranse utføres automatisk uten menneskelig handling.",
      "Alle tall bygger på ordrehistorikk, day_choices og statiske kataloger — verifiser mot faktisk drift.",
    ],
    dataUsed: {
      ordersWindow: { from, to: today },
      nextTargetDate: nextTarget,
      choiceKeysDistinct: choiceMap.size,
      locations: locRows.length,
    },
    demand: {
      forecast: nextForecast,
      portionMix: allocations,
      explain: nextForecast.explanation,
    },
    procurement: {
      lines: procurement.lines,
      transparency: procurement.transparency,
    },
    purchase: {
      lines: purchase.summaryLines,
      transparencyNote: purchase.transparencyNote,
    },
    suppliers: {
      lines: supplierLines,
      transparencyNote: "Regelbasert rangering (pris, ledetid, tilgjengelighet) — ikke kontraktsfestede priser.",
    },
    production,
    delivery: {
      ordered: route.ordered,
      transparency: route.transparency,
      routeSummary: route.ordered.map((s, i) => `${i + 1}. ${s.name} (${s.windowStart}–${s.windowEnd})`),
    },
    feedback: feedback
      ? {
          evaluationDate: feedback.evaluationDate,
          hindcastPredicted: feedback.hindcastPredicted,
          actualActive: feedback.actualActive,
          error: feedback.error,
          explain: feedback.explain,
        }
      : null,
    cost: cost,
    menuSignals: dishSignals.slice(0, 12),
    ai,
    /** Global OS — additiv nyttelast; eldre klienter ignorerer feltet. */
    globalOs,
  };

  await auditAdmin({
    actor_user_id: actorUserId,
    actor_email: actorEmail,
    action: "admin.operations_tower.read",
    company_id: companyId,
    location_id: locationId,
    meta: {
      rid,
      nextTarget,
      predicted: nextForecast.predictedOrders,
      globalOsSchemaVersion: globalOs.schemaVersion,
    },
  });

  return { data };
}

export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.operations_tower.read", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(scope.companyId);
  const actorUserId = safeStr(scope.userId);
  const actorEmail = scope.email ?? null;
  const locationId = scope.locationId ?? null;

  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  try {
    const autonomyQ = req.nextUrl.searchParams.get("autonomy");
    const built = await buildPayload(rid, companyId, locationId, actorUserId, actorEmail, autonomyQ);
    if ("error" in built && built.error) {
      return jsonErr(rid, "Kunne ikke hente driftsdata.", 500, { code: "FETCH_FAILED", detail: built.error });
    }
    return jsonOk(rid, built.data, 200);
  } catch (e: unknown) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String((e as Error)?.message ?? e) } });
  }
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.operations_tower.ack", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(scope.companyId);
  const actorUserId = safeStr(scope.userId);
  const actorEmail = scope.email ?? null;
  const locationId = scope.locationId ?? null;

  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const body = await readJson(req);
  const planRid = safeStr(body?.planRid);
  const df = body?.decisionFeedback;
  const decisionId = df && typeof df === "object" ? safeStr((df as Record<string, unknown>).decisionId) : "";
  const outcome = df && typeof df === "object" ? safeStr((df as Record<string, unknown>).outcome) : "";

  if (decisionId && (outcome === "accepted" || outcome === "rejected")) {
    await auditAdmin({
      actor_user_id: actorUserId,
      actor_email: actorEmail,
      action: "admin.operations_tower.decision_feedback",
      company_id: companyId,
      location_id: locationId,
      meta: {
        rid,
        planRid: planRid || null,
        decisionId,
        outcome,
        learningNote:
          outcome === "accepted"
            ? "Forslag akseptert — brukes som positiv signal i fremtidig kalibrering (manuell/analytisk)."
            : "Forslag avvist — brukes som negativt signal; ingen automatisk modellendring i V1.",
        reversible: true,
      },
    });

    return jsonOk(
      rid,
      {
        feedbackRecorded: true,
        decisionId,
        outcome,
        transparencyNote:
          "Tilbakemelding er versjonert i revisjonslogg. Systemet endrer ikke avtaler eller priser automatisk.",
      },
      200,
    );
  }

  await auditAdmin({
    actor_user_id: actorUserId,
    actor_email: actorEmail,
    action: "admin.operations_tower.ack",
    company_id: companyId,
    location_id: locationId,
    meta: { rid, planRid, note: "Menneskelig godkjenning registrert — ingen automatisk utførelse." },
  });

  return jsonOk(
    rid,
    {
      acknowledged: true,
      planRid: planRid || null,
      transparencyNote: "Godkjenning er kun logget for sporbarhet. Utfør innkjøp og produksjon manuelt i egne systemer.",
    },
    200,
  );
  });
}
