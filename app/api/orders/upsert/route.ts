import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";
import { supabaseServer } from "@/lib/supabase/server";
import { lpOrderSet, normalizeOrderTableSlot } from "@/lib/orders/rpcWrite";

function mustISODate(s: string) {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s);
}

export async function POST(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const companyId = String((scope as any)?.companyId ?? "").trim();
  const locationId = String((scope as any)?.locationId ?? "").trim();
  const userId = String((scope as any)?.userId ?? "").trim();
  const role = String((scope as any)?.role ?? "").trim();

  const routeName = "POST /api/orders/upsert";

  const idemKey = req.headers.get("Idempotency-Key")?.trim() ?? "";
  if (idemKey.length < 8) {
    return jsonErr(rid, "Idempotency-Key header mangler eller er for kort.", 400, "IDEMPOTENCY_REQUIRED");
  }

  const denyRole = requireRoleOr403(a.ctx, "orders.upsert", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const supabase = await supabaseServer();

  {
    const { data: rl, error: rlErr } = await supabase.rpc("rate_limit_allow", {
      p_action: "orders_upsert",
      p_limit: 6,
      p_window_seconds: 60,
    });
    if (rlErr) {
      return jsonErr(rid, "Kunne ikke sjekke rate limit.", 500, "RATE_LIMIT_CHECK_FAILED", { message: rlErr.message });
    }

    const row = Array.isArray(rl) ? rl[0] : rl;
    if (!row?.allowed) {
      return jsonErr(rid, "For mange forespørsler. Prøv igjen straks.", 429, "RATE_LIMITED", {
        retry_after_seconds: row?.retry_after_seconds ?? 30,
      });
    }
  }

  {
    const { data: cached, error: idemErr } = await supabase.rpc("idem_get", { p_route: routeName, p_key: idemKey });
    if (idemErr) {
      return jsonErr(rid, "Kunne ikke slå opp idempotency.", 500, "IDEMPOTENCY_LOOKUP_FAILED", { message: idemErr.message });
    }
    const row = Array.isArray(cached) ? cached[0] : cached;
    if (row?.found) {
      return NextResponse.json(row.response, { status: row.status_code, headers: { "cache-control": "no-store" } });
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_JSON");
  }

  const date = String(body?.date ?? "").trim();
  const note = body?.note == null ? null : String(body.note);
  const slot = normalizeOrderTableSlot(body?.slot);

  if (!mustISODate(date)) {
    return jsonErr(rid, "Dato må være YYYY-MM-DD.", 400, "INVALID_DATE");
  }

  const setRes = await lpOrderSet(supabase as any, {
    p_date: date,
    p_slot: slot,
    p_note: note,
  });

  if (!setRes.ok) {
    const msg = setRes.error?.message ?? "";
    const code =
      msg.includes("CUTOFF_PASSED") ? "CUTOFF_PASSED" :
      msg.includes("AGREEMENT_NOT_ACTIVE") ? "AGREEMENT_NOT_ACTIVE" :
      msg.includes("DELIVERY_DAY_INVALID") ? "DELIVERY_DAY_INVALID" :
      msg.includes("SLOT_INVALID") ? "SLOT_INVALID" :
      msg.includes("EMPLOYEE_NOT_ASSIGNED") ? "EMPLOYEE_NOT_ASSIGNED" :
      "ORDER_UPSERT_FAILED";

    const res = jsonErr(rid, "Bestillingen kunne ikke registreres.", 409, code, { db: msg });
    await supabase.rpc("idem_put", { p_route: routeName, p_key: idemKey, p_status: 409, p_response: await res.clone().json() });
    return res;
  }

  const row = setRes.row ?? null;
  const res = jsonOk(rid, {
    receipt: {
      rid,
      orderId: row?.order_id ?? row?.orderId ?? null,
      status: row?.status ?? null,
      timestamp: new Date().toISOString(),
    },
    order: row ?? null,
  });

  const orderId = String(row?.order_id ?? row?.orderId ?? "").trim();
  try {
    const { normalizeOrderAttributionInput, readAttributionCookieFromRequest } = await import("@/lib/revenue/session");
    const { persistOrderAttribution } = await import("@/lib/revenue/persistOrderAttribution");
    const attr = normalizeOrderAttributionInput(body, readAttributionCookieFromRequest(req));
    if (orderId && attr) {
      await persistOrderAttribution(orderId, attr, rid);
    }
  } catch {
    /* attributjon skal aldri blokkere upsert */
  }

  try {
    const { applyLeadPipelineOrderAttribution } = await import("@/lib/revenue/applyLeadPipelineOrderAttribution");
    await applyLeadPipelineOrderAttribution({
      orderId,
      userEmail: String((scope as { email?: unknown })?.email ?? "").trim() || null,
      rid,
    });
  } catch {
    /* lead_pipeline / SoMe-metrics skal aldri blokkere upsert */
  }

  await supabase.rpc("idem_put", { p_route: routeName, p_key: idemKey, p_status: 200, p_response: await res.clone().json() });

  return res;
}
