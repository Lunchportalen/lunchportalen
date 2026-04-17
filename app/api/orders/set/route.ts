export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* agents-ci: JSON responses include ok: true, rid: (success) and ok: false, rid: (errors) via jsonOrderWrite*. */

import type { NextRequest } from "next/server";

import { isIsoDate } from "@/lib/date/oslo";
import { coerceOrderWriteErrorResponse, jsonOrderWriteErr, jsonOrderWriteOk, orderWriteStatusFromDb } from "@/lib/http/respond";
import { companyIdFromCtx, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { getPublishedMenuForDate } from "@/lib/cms/menuContent";
import { assertCompanyOrderWriteAllowed } from "@/lib/orders/companyOrderEligibility";
import { assertEmployeeOrderBodyHasNoPricingOverrides, assertOrderWithinAgreementPreflight } from "@/lib/orders/orderWriteGuard";
import { agreementRuleSlotForOrderTableSlot, normalizeOrderTableSlot } from "@/lib/orders/rpcWrite";
import { auditLog, buildAuditEventFromAuthedCtx } from "@/lib/audit/log";
import { supabaseServer } from "@/lib/supabase/server";
import { fanoutLpOrderSetOutboxBestEffort } from "@/lib/orderBackup/outbox";

type OrderSetBody = {
  date?: string;
  action?: "ORDER" | "CANCEL" | string;
  note?: string | null;
  slot?: string | null;
};

type RpcOrderSetData = {
  order_id?: string;
  status?: string;
  company_id?: string;
  location_id?: string;
  date?: string;
  slot?: string | null;
  receipt?: string;
  rid?: string;
} | null;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeAction(action: unknown): "ORDER" | "CANCEL" | null {
  const up = safeStr(action).toUpperCase();
  if (up === "ORDER") return "ORDER";
  if (up === "CANCEL") return "CANCEL";
  return null;
}

function sanitizeNote(note: unknown): string | null {
  const s = safeStr(note);
  if (!s) return null;
  return s.slice(0, 300);
}

function mapRpcErrorToHttp(message: string) {
  const m = safeStr(message).toUpperCase();
  if (m.includes("UNAUTHENTICATED")) return { status: 401, code: "UNAUTHENTICATED" };
  if (m.includes("DATE_REQUIRED")) return { status: 400, code: "DATE_REQUIRED" };
  if (m.includes("ACTION_INVALID")) return { status: 400, code: "ACTION_INVALID" };
  if (m.includes("PROFILE_MISSING")) return { status: 409, code: "PROFILE_MISSING" };
  if (m.includes("NO_ACTIVE_AGREEMENT")) return { status: 409, code: "NO_ACTIVE_AGREEMENT" };
  if (m.includes("OUTSIDE_DELIVERY_DAYS")) return { status: 409, code: "OUTSIDE_DELIVERY_DAYS" };
  if (m.includes("CUTOFF_PASSED")) return { status: 409, code: "CUTOFF_PASSED" };
  if (m.includes("ORDER_RPC_FAILED")) return { status: 500, code: "ORDER_RPC_FAILED" };
  return { status: 500, code: "ORDER_SET_FAILED" };
}

function extractRpcPayload(data: unknown): RpcOrderSetData {
  if (!data) return null;
  if (Array.isArray(data)) return (data[0] as RpcOrderSetData) ?? null;
  if (typeof data === "object") return data as RpcOrderSetData;
  return null;
}

export async function POST(req: NextRequest) {
  const auth = await scopeOr401(req);
  if (auth.ok === false) return await coerceOrderWriteErrorResponse(auth.res ?? auth.response);

  const { rid } = auth.ctx;

  const denyRole = requireRoleOr403(auth.ctx, "api.orders.set.POST", ["employee"]);
  if (denyRole) return await coerceOrderWriteErrorResponse(denyRole);

  const body = (await readJson(req)) as OrderSetBody;
  const date = safeStr(body?.date);
  const action = normalizeAction(body?.action);
  const note = sanitizeNote(body?.note ?? null);
  const slot = normalizeOrderTableSlot(body?.slot ?? "");

  if (!isIsoDate(date)) {
    return jsonOrderWriteErr(rid, 400, "BAD_DATE", "Ugyldig dato. Bruk YYYY-MM-DD.");
  }

  if (!action) {
    return jsonOrderWriteErr(rid, 400, "BAD_ACTION", "Ugyldig action. Bruk ORDER eller CANCEL.");
  }

  // Fail-closed menu gate: ordering is blocked unless menu is published for date.
  // Requirement states this gate must run before RPC on this endpoint.
  try {
    const menu = await getPublishedMenuForDate(date);
    if (!menu) {
      return jsonOrderWriteErr(rid, 409, "MENU_NOT_PUBLISHED", "Meny er ikke publisert for datoen.");
    }
  } catch {
    return jsonOrderWriteErr(rid, 409, "MENU_NOT_PUBLISHED", "Kunne ikke verifisere meny-status.");
  }

  const pricingGuard = assertEmployeeOrderBodyHasNoPricingOverrides(body, auth.ctx.scope.role);
  if ("code" in pricingGuard) {
    return jsonOrderWriteErr(rid, 403, pricingGuard.code, "Du kan ikke overstyre pris eller plan i bestillingen.");
  }

  const sb = await supabaseServer();
  const companyId = companyIdFromCtx(auth.ctx);
  if (action === "ORDER" || action === "CANCEL") {
    if (!companyId) {
      return jsonOrderWriteErr(rid, 403, "COMPANY_SCOPE_REQUIRED", "Mangler firmatilknytning for bestilling.");
    }
    const hold = await assertCompanyOrderWriteAllowed(sb, companyId, rid);
    if (hold.ok === false) {
      return jsonOrderWriteErr(rid, hold.status, hold.code, hold.message);
    }
    const pre = await assertOrderWithinAgreementPreflight({
      sb,
      companyId,
      locationId: safeStr(auth.ctx.scope.locationId) || null,
      orderIsoDate: date,
      agreementRuleSlot: agreementRuleSlotForOrderTableSlot(slot),
      rid,
      action: action === "CANCEL" ? "CANCEL" : "SET",
    });
    if (pre.ok === false) {
      return jsonOrderWriteErr(rid, pre.status, pre.code, pre.message);
    }
  }

  const { data, error } = await sb.rpc("lp_order_set", {
    p_date: date,
    p_action: action,
    p_note: note,
    p_slot: slot,
  });

  if (error) {
    const mapped = mapRpcErrorToHttp(error.message);
    return jsonOrderWriteErr(rid, mapped.status, mapped.code, "Bestilling kunne ikke lagres.");
  }

  const rpc = extractRpcPayload(data);
  const orderId = safeStr(rpc?.order_id);
  if (!orderId) {
    return jsonOrderWriteErr(rid, 500, "ORDER_SET_BAD_RESPONSE", "Bestilling kunne ikke verifiseres etter lagring.");
  }

  const outStatus = safeStr(rpc?.status).toUpperCase() || (action === "ORDER" ? "ORDERED" : "CANCELED");

  auditLog(
    buildAuditEventFromAuthedCtx(auth.ctx, {
      action: action === "ORDER" ? "CREATE" : "UPDATE",
      resource: "orders:set",
      resourceId: orderId,
      metadata: { date, orderAction: action },
    }),
  );

  const rpcDate = safeStr(rpc?.date) || date;
  await fanoutLpOrderSetOutboxBestEffort({
    userId: auth.ctx.scope.userId,
    date: rpcDate,
    slot,
  });

  return jsonOrderWriteOk(rid, {
    orderId,
    status: orderWriteStatusFromDb(outStatus),
    date: rpcDate,
    timestamp: new Date().toISOString(),
  });
}
