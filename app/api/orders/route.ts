export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* agents-ci: JSON responses include ok: true, rid: (success) and ok: false, rid: (errors) via jsonOrderWrite*. */

import "server-only";

import type { NextRequest } from "next/server";
import {
  coerceOrderWriteErrorResponse,
  jsonOrderWriteErr,
  jsonOrderWriteOk,
  makeRid,
  orderWriteStatusFromDb,
} from "@/lib/http/respond";
import { runInstrumentedApi } from "@/lib/http/withObservability";
import { companyIdFromCtx, scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { recordRevenue } from "@/lib/observability/store";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { osloTodayISODate } from "@/lib/date/oslo";
import { weekdayKeyFromOsloISODate } from "@/lib/date/weekdayKeyFromIso";
import { GET as OrdersTodayGET } from "@/app/api/orders/today/route";
import { trackOrderAiConversion } from "@/lib/revenue/trackOrderAiConversion";
import { assertCompanyOrderWriteAllowed } from "@/lib/orders/companyOrderEligibility";
import { assertEmployeeOrderBodyHasNoPricingOverrides, assertOrderWithinAgreementPreflight } from "@/lib/orders/orderWriteGuard";
import { resolveOrderDayItemPersist } from "@/lib/orders/resolveOrderDayItemPersist";
import { agreementRuleSlotForOrderTableSlot, normalizeOrderTableSlot } from "@/lib/orders/rpcWrite";
import { orderWriteBodySchema } from "@/lib/validation/schemas";
import { persistMvoOnOrder } from "@/lib/mvo/persistOrderMvo";
import { fanoutLpOrderSetOutboxBestEffort } from "@/lib/orderBackup/outbox";
import { getAgreementStatus, type Tier } from "@/lib/auth/agreementStatus";
import { PLAN_ORDER_CHOICE_KEYS } from "@/lib/cms/menuDayContract";

type OrderBody = {
  date?: unknown;
  action?: unknown;
  note?: unknown;
  slot?: unknown;
  choice_key?: unknown;
  attribution?: unknown;
};

type RpcOut = {
  order_id?: unknown;
  status?: unknown;
  date?: unknown;
  slot?: unknown;
  receipt?: unknown;
  cutoff_passed?: unknown;
  rid?: unknown;
} | null;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isIsoDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function normalizeAction(v: unknown): "SET" | "CANCEL" | null {
  const a = safeStr(v).toUpperCase();
  if (a === "SET" || a === "ORDER" || a === "PLACE") return "SET";
  if (a === "CANCEL") return "CANCEL";
  return null;
}

function sanitizeNote(v: unknown) {
  const s = safeStr(v);
  return s ? s.slice(0, 300) : null;
}

function sanitizeSlot(v: unknown) {
  const s = safeStr(v).toLowerCase();
  if (!s || s === "lunch") return "default";
  return s || "default";
}

function sanitizeChoiceKey(v: unknown) {
  return safeStr(v).toLowerCase();
}

function sanitizeItemKeyFromBody(body: Record<string, unknown>): string | null {
  const raw = body.itemKey ?? body.item_key;
  const s = safeStr(raw);
  return s ? s.slice(0, 160) : null;
}

function mapRpcError(messageRaw: unknown) {
  const m = safeStr(messageRaw).toUpperCase();

  if (m.includes("DATE_REQUIRED") || m.includes("ACTION_INVALID")) {
    return { status: 400, code: "BAD_INPUT", message: "Bestillingen mangler gyldige felter." };
  }
  if (m.includes("NO_ACTIVE_AGREEMENT")) {
    return {
      status: 409,
      code: "NO_ACTIVE_AGREEMENT",
      message: "Du kan ikke bestille fordi firmaet ikke har en aktiv avtale.",
    };
  }
  if (m.includes("OUTSIDE_DELIVERY_DAYS")) {
    return {
      status: 409,
      code: "OUTSIDE_DELIVERY_DAYS",
      message: "Denne dagen er ikke en leveringsdag.",
    };
  }
  if (m.includes("CUTOFF_PASSED")) {
    return {
      status: 409,
      code: "CUTOFF_PASSED",
      message: "Fristen for i dag er passert (kl. 08:00).",
    };
  }
  if (m.includes("PROFILE_MISSING") || m.includes("SCOPE_FORBIDDEN")) {
    return {
      status: 403,
      code: "SCOPE_FORBIDDEN",
      message: "Du har ikke tilgang til å bestille for denne brukeren.",
    };
  }
  if (m.includes("UNAUTHENTICATED")) {
    return { status: 401, code: "UNAUTHENTICATED", message: "Du må logge inn for å bestille." };
  }
  if (m.includes("SLOT") || m.includes("INVALID_SLOT")) {
    return { status: 400, code: "INVALID_SLOT", message: "Ugyldig leveringsslot." };
  }

  return { status: 500, code: "ORDER_SET_FAILED", message: "Vi kunne ikke lagre bestillingen nå." };
}

function asRpcOut(data: unknown): RpcOut {
  if (!data) return null;
  if (Array.isArray(data)) return (data[0] as RpcOut) ?? null;
  if (typeof data === "object") return data as RpcOut;
  return null;
}

async function writeOrder(req: NextRequest, forcedAction?: "SET" | "CANCEL") {
  const g = await scopeOr401(req);
  if (g.ok === false) return await coerceOrderWriteErrorResponse(g.res ?? g.response);

  const deny = requireRoleOr403(g.ctx, "orders.write", ["employee", "company_admin"]);
  if (deny) return await coerceOrderWriteErrorResponse(deny);

  const rid = req.headers.get("x-rid")?.trim() || g.ctx.rid || makeRid("rid_orders");

  return runInstrumentedApi(req, { rid, route: "/api/orders" }, async () => {
    try {
      const rawBody = await readJson(req);
      const validated = orderWriteBodySchema.safeParse(rawBody);
      if (!validated.success) {
        return jsonOrderWriteErr(rid, 422, "VALIDATION_FAILED", "Ugyldig forespørsel.");
      }
      const body = validated.data as OrderBody;
      const date = safeStr(body?.date) || osloTodayISODate();
    const action = forcedAction ?? normalizeAction(body?.action);
    const note = sanitizeNote(body?.note);
    const slot = sanitizeSlot(body?.slot);
    const choiceKeyInput = sanitizeChoiceKey(body?.choice_key);

    if (!isIsoDate(date)) {
      return jsonOrderWriteErr(rid, 400, "BAD_DATE", "Dato må være på formatet ÅÅÅÅ-MM-DD.");
    }

    if (!action) {
      return jsonOrderWriteErr(rid, 400, "BAD_ACTION", "Du må velge en gyldig handling.");
    }

    const dayKey = weekdayKeyFromOsloISODate(date);
    if (!dayKey) {
      return jsonOrderWriteErr(rid, 422, "INVALID_DAY", "Dato må være mandag til fredag.", { date });
    }

    try {
      const { enforceSystemGate } = await import("@/lib/system/enforcement");
      await enforceSystemGate({
        action: action === "SET" ? "ORDER_CREATE" : "ORDER_CANCEL",
      });
    } catch (e: unknown) {
      const msg = String(e instanceof Error ? e.message : e);
      if (msg === "ORDERS_BLOCKED") {
        return jsonOrderWriteErr(rid, 503, "ORDERS_BLOCKED", "Bestilling er midlertidig deaktivert.");
      }
      if (msg === "CANCELLATIONS_BLOCKED") {
        return jsonOrderWriteErr(rid, 503, "CANCELLATIONS_BLOCKED", "Avbestilling er midlertidig deaktivert.");
      }
      if (msg === "SYSTEM_HALTED") {
        return jsonOrderWriteErr(rid, 503, "SYSTEM_HALTED", "Systemet er midlertidig stoppet.");
      }
      if (msg === "SETTINGS_UNAVAILABLE") {
        return jsonOrderWriteErr(rid, 503, "SETTINGS_UNAVAILABLE", "Systeminnstillinger er ikke tilgjengelige akkurat nå.");
      }
      if (msg.startsWith("FEATURE_DISABLED:")) {
        return jsonOrderWriteErr(rid, 503, "FEATURE_DISABLED", "Funksjonen er deaktivert i systeminnstillinger.");
      }
      if (msg.startsWith("KILL_SWITCH:")) {
        return jsonOrderWriteErr(rid, 503, "KILL_SWITCH", "Funksjonen er stoppet av killswitch.");
      }
      throw e;
    }

    const pricingGuard = assertEmployeeOrderBodyHasNoPricingOverrides(body, g.ctx.scope.role);
    if ("code" in pricingGuard) {
      return jsonOrderWriteErr(rid, 403, pricingGuard.code, "Du kan ikke overstyre pris eller plan i bestillingen.");
    }

    const tableSlot = normalizeOrderTableSlot(slot);
    let resolvedTier: Tier | null = null;
    let finalChoiceKey: string | null = action === "SET" ? choiceKeyInput || null : null;
    let persistedItemKey: string | null = null;
    let persistedItemTitleSnapshot: string | null = null;
    if (action === "SET" || action === "CANCEL") {
      const cid = companyIdFromCtx(g.ctx);
      if (!cid) {
        return jsonOrderWriteErr(rid, 403, "COMPANY_SCOPE_REQUIRED", "Mangler firmatilknytning for bestilling.");
      }
      const sbPre = await supabaseServer();
      const hold = await assertCompanyOrderWriteAllowed(sbPre, cid, rid);
      if (hold.ok === false) {
        return jsonOrderWriteErr(rid, hold.status, hold.code, hold.message);
      }
      const pre = await assertOrderWithinAgreementPreflight({
        sb: sbPre,
        companyId: cid,
        locationId: safeStr(g.ctx.scope.locationId) || null,
        orderIsoDate: date,
        agreementRuleSlot: agreementRuleSlotForOrderTableSlot(tableSlot),
        rid,
        action: action === "CANCEL" ? "CANCEL" : "SET",
      });
      if (pre.ok === false) {
        return jsonOrderWriteErr(rid, pre.status, pre.code, pre.message);
      }

      const agreementStatus = await getAgreementStatus(sbPre as any, cid);
      resolvedTier = agreementStatus.dayTiers[dayKey] ?? null;

      if (action === "SET") {
        if (!resolvedTier) {
          return jsonOrderWriteErr(rid, 422, "NO_TIER_FOR_DAY", "Denne dagen er ikke tilgjengelig for bestilling.", {
            date,
          });
        }

        const availableChoices = PLAN_ORDER_CHOICE_KEYS[resolvedTier] ?? [];
        if (availableChoices.length > 1 && !finalChoiceKey) {
          return jsonOrderWriteErr(rid, 422, "CHOICE_REQUIRED", "Menyvalg er påkrevd. Velg en kategori før bestilling.", {
            tier: resolvedTier,
            available_choices: availableChoices,
          });
        }
        if (availableChoices.length === 1 && !finalChoiceKey) {
          finalChoiceKey = availableChoices[0] ?? null;
        }
        if (!finalChoiceKey || !availableChoices.includes(finalChoiceKey)) {
          return jsonOrderWriteErr(rid, 422, "INVALID_CHOICE", "Valget er ikke tillatt for denne dagen.", {
            tier: resolvedTier,
            choice_key: finalChoiceKey,
            available_choices: availableChoices,
          });
        }

        const itemBody = validated.data as unknown as Record<string, unknown>;
        const itemResolved = await resolveOrderDayItemPersist({
          date,
          planTier: resolvedTier,
          choiceKey: finalChoiceKey,
          clientItemKey: sanitizeItemKeyFromBody(itemBody),
        });
        if (itemResolved.ok === false) {
          return jsonOrderWriteErr(rid, itemResolved.status, itemResolved.code, itemResolved.message);
        }
        persistedItemKey = itemResolved.item_key;
        persistedItemTitleSnapshot = itemResolved.item_title_snapshot;
      }
    }

    const sb = await supabaseServer();
    const { data, error } = await sb.rpc("lp_order_set", {
      p_date: date,
      p_action: action,
      p_note: note,
      p_slot: tableSlot,
    });

    if (error) {
      const mapped = mapRpcError(error.message);
      return jsonOrderWriteErr(rid, mapped.status, mapped.code, mapped.message);
    }

    const out = asRpcOut(data);
    const orderId = safeStr(out?.order_id);
    const savedStatus = safeStr(out?.status).toUpperCase();
    const savedDate = safeStr(out?.date) || date;

    if (!orderId || !savedStatus) {
      return jsonOrderWriteErr(rid, 500, "ORDER_SET_BAD_RESPONSE", "Vi kunne ikke lagre bestillingen nå.");
    }

    if (action === "SET" && savedStatus === "ACTIVE") {
      try {
        const { normalizeOrderAttributionInput, readAttributionCookieFromRequest } = await import("@/lib/revenue/session");
        const { persistOrderAttribution } = await import("@/lib/revenue/persistOrderAttribution");
        const attr = normalizeOrderAttributionInput(body, readAttributionCookieFromRequest(req));
        if (orderId && attr) {
          await persistOrderAttribution(orderId, attr, rid);
        }
      } catch {
        /* attributjon skal aldri blokkere bestilling */
      }

      try {
        const { applyLeadPipelineOrderAttribution } = await import("@/lib/revenue/applyLeadPipelineOrderAttribution");
        await applyLeadPipelineOrderAttribution({
          orderId,
          userEmail: g.ctx.scope.email,
          rid,
        });
      } catch {
        /* lead_pipeline / SoMe-metrics skal aldri blokkere bestilling */
      }

      try {
        const mvoRaw = (body as Record<string, unknown>).mvo;
        if (mvoRaw && typeof mvoRaw === "object" && !Array.isArray(mvoRaw)) {
          const m = mvoRaw as Record<string, unknown>;
          const adminMvo = supabaseAdmin();
          await persistMvoOnOrder(adminMvo, {
            orderId,
            rid,
            mvo: {
              variant_channel: typeof m.variant_channel === "string" ? m.variant_channel : undefined,
              variant_segment: typeof m.variant_segment === "string" ? m.variant_segment : undefined,
              variant_timing: typeof m.variant_timing === "string" ? m.variant_timing : undefined,
              market_id: typeof m.market_id === "string" ? m.market_id : undefined,
            },
          });
        }
      } catch {
        /* MVO-felt skal aldri blokkere bestilling */
      }

      try {
        const expH = safeStr(req.headers.get("x-experiment-id"));
        const varH = safeStr(req.headers.get("x-variant-id"));
        const companyId = safeStr(g.ctx.scope.companyId);
        if (expH && varH && isUuid(expH) && companyId && isUuid(companyId)) {
          const admin = supabaseAdmin();
          let revenue = 0;
          const ordRes = await admin.from("orders").select("line_total").eq("id", orderId).maybeSingle();
          if (!ordRes.error && ordRes.data && typeof ordRes.data === "object" && ordRes.data !== null) {
            const lt = (ordRes.data as { line_total?: unknown }).line_total;
            if (typeof lt === "number" && Number.isFinite(lt)) revenue = lt;
            else if (typeof lt === "string" && lt.trim()) {
              const n = Number(lt);
              if (Number.isFinite(n)) revenue = n;
            }
          }
          const ins = await admin.from("experiment_revenue").insert({
            experiment_id: expH,
            variant_id: varH,
            company_id: companyId,
            revenue,
          });
          if (ins.error) {
            opsLog("revenue_track_failed", { rid, message: ins.error.message, orderId });
          } else {
            opsLog("revenue_tracked", { rid, experimentId: expH, variantId: varH, companyId, orderId, revenue });
          }
        }
      } catch {
        /* never block order response */
      }

      try {
        const admin = supabaseAdmin();
        let revenue = 0;
        const ordRes = await admin.from("orders").select("line_total").eq("id", orderId).maybeSingle();
        if (!ordRes.error && ordRes.data && typeof ordRes.data === "object" && ordRes.data !== null) {
          const lt = (ordRes.data as { line_total?: unknown }).line_total;
          if (typeof lt === "number" && Number.isFinite(lt)) revenue = lt;
          else if (typeof lt === "string" && lt.trim()) {
            const n = Number(lt);
            if (Number.isFinite(n)) revenue = n;
          }
        }
        await trackOrderAiConversion({
          orderId,
          companyId: companyIdFromCtx(g.ctx),
          revenue,
        });
        if (revenue > 0) recordRevenue(revenue);
      } catch {
        /* never block order response */
      }
    }

    await fanoutLpOrderSetOutboxBestEffort({
      userId: g.ctx.scope.userId,
      date: savedDate,
      slot: tableSlot,
    });

    if (action === "SET" && savedStatus === "ACTIVE" && finalChoiceKey) {
      const adminChoices = supabaseAdmin();
      const { error: dayChoiceErr } = await (adminChoices as any)
        .from("day_choices")
        .upsert(
          {
            company_id: safeStr(g.ctx.scope.companyId),
            location_id: safeStr(g.ctx.scope.locationId),
            user_id: safeStr(g.ctx.scope.userId),
            date: savedDate,
            choice_key: finalChoiceKey,
            item_key: persistedItemKey,
            item_title_snapshot: persistedItemTitleSnapshot,
            note,
            status: "ACTIVE",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id,location_id,user_id,date" }
        );
      if (dayChoiceErr) {
        return jsonOrderWriteErr(rid, 500, "DAY_CHOICE_SAVE_FAILED", "Bestilling lagret, men menyvalg kunne ikke lagres. Prøv igjen.");
      }
    }

    if (action === "CANCEL" && savedStatus === "CANCELLED") {
      const adminChoices = supabaseAdmin();
      const del = await (adminChoices as any)
        .from("day_choices")
        .delete()
        .eq("company_id", safeStr(g.ctx.scope.companyId))
        .eq("location_id", safeStr(g.ctx.scope.locationId))
        .eq("user_id", safeStr(g.ctx.scope.userId))
        .eq("date", savedDate);
      if (del?.error) {
        return jsonOrderWriteErr(rid, 500, "DAY_CHOICE_DELETE_FAILED", "Avbestilling lagret, men menyvalg kunne ikke ryddes. Prøv igjen.");
      }
    }

    return jsonOrderWriteOk(rid, {
      orderId,
      status: orderWriteStatusFromDb(savedStatus),
      date: savedDate,
      timestamp: new Date().toISOString(),
      tier: resolvedTier,
    });
  } catch {
    return jsonOrderWriteErr(rid, 500, "ORDER_SET_FAILED", "Vi kunne ikke lagre bestillingen nå.");
  }
  });
}

export async function GET(req: NextRequest) {
  return OrdersTodayGET(req);
}

export async function POST(req: NextRequest) {
  return writeOrder(req);
}

export async function DELETE(req: NextRequest) {
  return writeOrder(req, "CANCEL");
}
