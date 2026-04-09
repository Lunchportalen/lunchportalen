export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { isIsoDate } from "@/lib/date/oslo";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { companyIdFromCtx, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { getPublishedMenuForDate } from "@/lib/cms/menuContent";
import { assertCompanyOrderWriteAllowed } from "@/lib/orders/companyOrderEligibility";
import { assertEmployeeOrderBodyHasNoPricingOverrides, assertOrderWithinAgreementPreflight } from "@/lib/orders/orderWriteGuard";
import { agreementRuleSlotForOrderTableSlot, normalizeOrderTableSlot } from "@/lib/orders/rpcWrite";
import { auditLog, buildAuditEventFromAuthedCtx } from "@/lib/audit/log";
import { supabaseServer } from "@/lib/supabase/server";

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
  if (auth.ok === false) return auth.response;

  const { rid } = auth.ctx;

  const denyRole = requireRoleOr403(auth.ctx, "api.orders.set.POST", ["employee"]);
  if (denyRole) return denyRole;

  const body = (await readJson(req)) as OrderSetBody;
  const date = safeStr(body?.date);
  const action = normalizeAction(body?.action);
  const note = sanitizeNote(body?.note ?? null);
  const slot = normalizeOrderTableSlot(body?.slot ?? "");

  if (!isIsoDate(date)) {
    return jsonErr(rid, "Ugyldig dato. Bruk YYYY-MM-DD.", 400, "BAD_DATE");
  }

  if (!action) {
    return jsonErr(rid, "Ugyldig action. Bruk ORDER eller CANCEL.", 400, "BAD_ACTION");
  }

  // Fail-closed menu gate: ordering is blocked unless menu is published for date.
  // Requirement states this gate must run before RPC on this endpoint.
  try {
    const menu = await getPublishedMenuForDate(date);
    if (!menu) {
      return jsonErr(rid, "Meny er ikke publisert for datoen.", 409, "MENU_NOT_PUBLISHED");
    }
  } catch {
    return jsonErr(rid, "Kunne ikke verifisere meny-status.", 409, "MENU_NOT_PUBLISHED");
  }

  const pricingGuard = assertEmployeeOrderBodyHasNoPricingOverrides(body, auth.ctx.scope.role);
  if ("code" in pricingGuard) {
    return jsonErr(rid, "Du kan ikke overstyre pris eller plan i bestillingen.", 403, pricingGuard.code);
  }

  const sb = await supabaseServer();
  const companyId = companyIdFromCtx(auth.ctx);
  if (action === "ORDER") {
    if (!companyId) {
      return jsonErr(rid, "Mangler firmatilknytning for bestilling.", 403, "COMPANY_SCOPE_REQUIRED");
    }
    const hold = await assertCompanyOrderWriteAllowed(sb, companyId, rid);
    if (hold.ok === false) {
      return jsonErr(rid, hold.message, hold.status, hold.code);
    }
    const pre = await assertOrderWithinAgreementPreflight({
      sb,
      companyId,
      orderIsoDate: date,
      agreementRuleSlot: agreementRuleSlotForOrderTableSlot(slot),
      rid,
      action: "SET",
    });
    if (pre.ok === false) {
      return jsonErr(rid, pre.message, pre.status, pre.code);
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
    return jsonErr(rid, "Bestilling kunne ikke lagres.", mapped.status, mapped.code, {
      message: error.message,
    });
  }

  const rpc = extractRpcPayload(data);
  const outStatus = safeStr(rpc?.status).toUpperCase() || (action === "ORDER" ? "ORDERED" : "CANCELED");

  auditLog(
    buildAuditEventFromAuthedCtx(auth.ctx, {
      action: action === "ORDER" ? "CREATE" : "UPDATE",
      resource: "orders:set",
      resourceId: rpc?.order_id ?? null,
      metadata: { date, orderAction: action },
    }),
  );

  return jsonOk(rid, {
    status: outStatus,
    receipt: {
      orderId: rpc?.order_id ?? null,
      timestamp: rpc?.receipt ?? null,
      rid: safeStr(rpc?.rid) || rid,
    },
    date: rpc?.date ?? date,
  });
}
