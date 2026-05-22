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
import { allocatePortionsProportional } from "@/lib/ai/portionAllocation";
import { hindcastLastDeliveryDay } from "@/lib/ai/operationsFeedback";
import { allCatalogMenuKeys } from "@/lib/ai/menuToIngredients";
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
  _autonomyQuery: string | null,
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

  const evalDay = lastBusinessDayOnOrBefore(addDaysISO(today, -1));
  const feedback = hindcastLastDeliveryDay({
    evaluationDate: evalDay,
    history,
    deliveryWeekdays: deliveryWeekdays ?? undefined,
  });

  const data = {
    planRid: rid,
    transparencyRoot: [
      "Ingen bestilling, menyendring, prisendring eller leveranse utføres automatisk uten menneskelig handling.",
      "Tall bygger på ordrehistorikk og day_choices — verifiser mot faktisk drift.",
      "Innkjøp, produksjon, rute og kostnadsoptimalisering er fjernet fra denne visningen (lib/ai cleanup 2026-05).",
    ],
    dataUsed: {
      ordersWindow: { from, to: today },
      nextTargetDate: nextTarget,
      choiceKeysDistinct: choiceMap.size,
    },
    demand: {
      forecast: nextForecast,
      portionMix: allocations,
      explain: nextForecast.explanation,
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
    menuSignals: dishSignals.slice(0, 12),
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
