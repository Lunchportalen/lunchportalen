export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { makeRid } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { supabaseServer } from "@/lib/supabase/server";
import { osloTodayISODate } from "@/lib/date/oslo";
import { GET as OrdersTodayGET } from "@/app/api/orders/today/route";

type OrderBody = {
  date?: unknown;
  action?: unknown;
  note?: unknown;
  slot?: unknown;
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
  const s = safeStr(v);
  return s || "default";
}

function json(rid: string, status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify({ ...payload, rid }), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-rid": rid,
    },
  });
}

function err(rid: string, status: number, code: string, message: string) {
  return json(rid, status, {
    ok: false,
    status,
    error: { code },
    message,
  });
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
  if (g.ok === false) return g.response;

  const deny = requireRoleOr403(g.ctx, "orders.write", ["employee", "company_admin"]);
  if (deny) return deny;

  const rid = g.ctx.rid || makeRid("rid_orders");

  const body = (await readJson(req)) as OrderBody;
  const date = safeStr(body?.date) || osloTodayISODate();
  const action = forcedAction ?? normalizeAction(body?.action);
  const note = sanitizeNote(body?.note);
  const slot = sanitizeSlot(body?.slot);

  if (!isIsoDate(date)) {
    return err(rid, 400, "BAD_DATE", "Dato må være på formatet ÅÅÅÅ-MM-DD.");
  }

  if (!action) {
    return err(rid, 400, "BAD_ACTION", "Du må velge en gyldig handling.");
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("lp_order_set", {
    p_date: date,
    p_action: action,
    p_note: note,
    p_slot: slot,
  });

  if (error) {
    const mapped = mapRpcError(error.message);
    return err(rid, mapped.status, mapped.code, mapped.message);
  }

  const out = asRpcOut(data);
  const orderId = safeStr(out?.order_id);
  const savedStatus = safeStr(out?.status).toUpperCase();
  const savedDate = safeStr(out?.date) || date;
  const savedSlot = safeStr(out?.slot) || slot;
  const receiptAt = safeStr(out?.receipt) || new Date().toISOString();

  if (!orderId || !savedStatus) {
    return err(rid, 500, "ORDER_SET_BAD_RESPONSE", "Vi kunne ikke lagre bestillingen nå.");
  }

  return json(rid, 200, {
    ok: true,
    orderId,
    status: savedStatus,
    date: savedDate,
    slot: savedSlot,
    receipt: {
      timestamp: receiptAt,
      cutoffPassed: false,
    },
    data: {
      orderId,
      status: savedStatus,
      date: savedDate,
      slot: savedSlot,
      receipt: {
        timestamp: receiptAt,
        cutoffPassed: false,
      },
    },
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
