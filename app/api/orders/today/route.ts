// app/api/orders/today/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


import { osloTodayISODate, cutoffStatusForDate } from "@/lib/date/oslo";
import { orderBase, receiptFor } from "@/lib/api/orderResponse";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

// ✅ MUST audit (lukket sirkel)
import { auditWriteMust } from "@/lib/audit/auditWrite";
import { auditSafe } from "@/lib/ops/auditSafe";
import { lpOrderCancel, lpOrderSet } from "@/lib/orders/rpcWrite";

type Action = "place" | "cancel";

/* =========================================================
   Helpers
========================================================= */

function clampNote(v: unknown) {
  const s = String(v ?? "").trim();
  return s.length ? s.slice(0, 300) : null;
}

type CompanyLifecycle = "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING" | "UNKNOWN";
function normCompanyStatus(v: any): CompanyLifecycle {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  if (s === "PENDING") return "PENDING";
  return "UNKNOWN";
}

async function adminClientOrNull() {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  try {
    return supabaseAdmin();
  } catch {
    return null;
  }
}

function lockedStateForDate(dateISO: string): { locked: boolean; cutoffTime: string; lockCode: string | null } {
  const cutoff = cutoffStatusForDate(dateISO);
  if (cutoff === "TODAY_LOCKED") return { locked: true, cutoffTime: "08:00", lockCode: "LOCKED_AFTER_0800" };
  if (cutoff === "PAST") return { locked: true, cutoffTime: "08:00", lockCode: "DATE_LOCKED_PAST" };
  return { locked: false, cutoffTime: "08:00", lockCode: null };
}

function jsonOrder(ctx: { rid: string }, status: number, body: any) {
  if (body?.ok === false) {
    const error = String(body?.error ?? "ERROR");
    const message = String(body?.message ?? "Ukjent feil.");
    return jsonErr(ctx.rid, message, status, error);
  }
  return jsonOk(ctx.rid, body, status);
}

/* =========================================================
   POST (place/cancel today)
========================================================= */
export async function POST(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;
  const today = osloTodayISODate();

  const denyRole = requireRoleOr403(a.ctx, "orders.today", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const user_id = String(scope.userId ?? "").trim();
  const company_id = String(scope.companyId ?? "").trim();
  const location_id = String(scope.locationId ?? "").trim();

  if (!user_id || !company_id) {
    return jsonOrder(a.ctx,
      409,
      orderBase({
        ok: false,
        rid,
        date: today,
        locked: false,
        cutoffTime: "08:00",
        menuAvailable: true,
        canAct: false,
        error: "SCOPE_MISSING",
        message: "Mangler scope (user/company).",
        detail: null,
        receipt: null,
        order: null,
      } as any)
    );
  }
  if (!location_id) {
    return jsonOrder(a.ctx,
      409,
      orderBase({
        ok: false,
        rid,
        date: today,
        locked: false,
        cutoffTime: "08:00",
        menuAvailable: true,
        canAct: false,
        error: "LOCATION_MISSING",
        message: "Mangler lokasjonstilknytning (location_id).",
        detail: null,
        receipt: null,
        order: null,
      } as any)
    );
  }

  try {
    const body = (await readJson(req)) as { action?: Action; note?: string | null };

    const action = body?.action;
    if (action !== "place" && action !== "cancel") {
      return jsonOrder(a.ctx,
        400,
        orderBase({
          ok: false,
          rid,
          date: today,
          locked: false,
          cutoffTime: "08:00",
          menuAvailable: true,
          canAct: false,
          error: "BAD_REQUEST",
          message: "Ugyldig action. Bruk 'place' eller 'cancel'.",
          detail: { action },
          receipt: null,
          order: null,
        } as any)
      );
    }

    const admin = await adminClientOrNull();
    if (!admin) {
      return jsonOrder(a.ctx,
        500,
        orderBase({
          ok: false,
          rid,
          date: today,
          locked: false,
          cutoffTime: "08:00",
          menuAvailable: true,
          canAct: false,
          error: "CONFIG_ERROR",
          message: "Mangler service role konfigurasjon for firmastatus/audit.",
          detail: { missing: ["service role client", "supabase url"] },
          receipt: null,
          order: null,
        } as any)
      );
    }

    const cRes = await admin.from("companies").select("id,status").eq("id", company_id).maybeSingle();
    if (cRes.error || !cRes.data) {
      return jsonOrder(a.ctx,
        500,
        orderBase({
          ok: false,
          rid,
          date: today,
          locked: false,
          cutoffTime: "08:00",
          menuAvailable: true,
          canAct: false,
          error: "COMPANY_LOOKUP_FAILED",
          message: "Kunne ikke verifisere firmastatus.",
          detail: { error: cRes.error?.message ?? null },
          receipt: null,
          order: null,
        } as any)
      );
    }

    const companyStatus = normCompanyStatus((cRes.data as any).status);
    if (companyStatus !== "ACTIVE") {
      const reason =
        companyStatus === "PAUSED" ? "COMPANY_PAUSED" : companyStatus === "CLOSED" ? "COMPANY_CLOSED" : "COMPANY_NOT_ACTIVE";

      await auditSafe(async () => {
        await auditWriteMust({
          rid,
          action: "ENFORCEMENT_BLOCK",
          entity_type: "order",
          entity_id: `${company_id}:${location_id}:${user_id}:${today}`,
          company_id,
          location_id,
          actor_user_id: user_id,
          actor_email: scope.email ?? null,
          actor_role: scope.role ?? null,
          summary: reason,
          detail: {
            route: "/api/orders/today",
            reason,
            message: "Firmaet er deaktivert.",
            intent: action.toUpperCase(),
            date: today,
            company_status: companyStatus,
          },
        });
      }, rid);

      return jsonOrder(a.ctx,
        403,
        orderBase({
          ok: false,
          rid,
          date: today,
          locked: false,
          cutoffTime: "08:00",
          menuAvailable: true,
          canAct: false,
          error: reason,
          message: "Firmaet er deaktivert.",
          detail: { company_status: companyStatus },
          receipt: null,
          order: null,
        } as any)
      );
    }

    const lock = lockedStateForDate(today);
    if (lock.locked) {
      await auditSafe(async () => {
        await auditWriteMust({
          rid,
          action: "ENFORCEMENT_BLOCK",
          entity_type: "order",
          entity_id: `${company_id}:${location_id}:${user_id}:${today}`,
          company_id,
          location_id,
          actor_user_id: user_id,
          actor_email: scope.email ?? null,
          actor_role: scope.role ?? null,
          summary: lock.lockCode ?? "LOCKED",
          detail: {
            route: "/api/orders/today",
            reason: lock.lockCode,
            message: "Bestilling/avbestilling er låst etter 08:00.",
            intent: action.toUpperCase(),
            date: today,
            cutoffTime: lock.cutoffTime,
          },
        });
      }, rid);

      return jsonOrder(a.ctx,
        409,
        orderBase({
          ok: false,
          rid,
          date: today,
          locked: true,
          cutoffTime: lock.cutoffTime,
          menuAvailable: true,
          canAct: false,
          error: lock.lockCode ?? "LOCKED",
          message: "Bestilling/avbestilling er låst etter 08:00.",
          detail: null,
          receipt: null,
          order: null,
        } as any)
      );
    }

    const sb = await supabaseServer();

    const note = clampNote(body?.note);
    const writeRes = action === "place"
      ? await lpOrderSet(sb as any, { p_date: today, p_slot: "lunch", p_note: note })
      : await lpOrderCancel(sb as any, { p_date: today });

    const { data: upserted, error: uErr } = await sb
      .from("orders")
      .select("id,status,date,created_at,updated_at,note,company_id,location_id")
      .eq("user_id", user_id)
      .eq("company_id", company_id)
      .eq("location_id", location_id)
      .eq("date", today)
      .eq("slot", "lunch")
      .maybeSingle();

    if (!writeRes.ok || uErr || !upserted) {
      return jsonOrder(a.ctx,
        500,
        orderBase({
          ok: false,
          rid,
          date: today,
          locked: false,
          cutoffTime: "08:00",
          menuAvailable: true,
          canAct: false,
          error: writeRes.code ?? "ORDER_RPC_FAILED",
          message: writeRes.error?.message ?? uErr?.message ?? "RPC feilet.",
          detail: { error: writeRes.error?.message ?? uErr?.message ?? "unknown" },
          receipt: null,
          order: null,
        } as any)
      );
    }
return jsonOrder(a.ctx,
      200,
      orderBase({
        ok: true,
        rid,
        date: upserted.date,
        locked: false,
        cutoffTime: "08:00",
        menuAvailable: true,
        canAct: true,
        error: null,
        message: String(upserted.status ?? "").toUpperCase() === "ACTIVE" ? "Bestilling registrert." : "Avbestilling registrert.",
        receipt: receiptFor(upserted.id, String(upserted.status ?? "unknown"), upserted.updated_at ?? upserted.created_at ?? new Date().toISOString()),
        order: upserted,
      } as any)
    );
  } catch (e: any) {
    return jsonOrder(a.ctx,
      500,
      orderBase({
        ok: false,
        rid,
        date: today,
        locked: false,
        cutoffTime: "08:00",
        menuAvailable: true,
        canAct: false,
        error: "SERVER_ERROR",
        message: e?.message ?? "Ukjent feil.",
        detail: { at: "orders/today" },
        receipt: null,
        order: null,
      } as any)
    );
  }
}

/* =========================================================
   GET (read-only status)
========================================================= */
export async function GET(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;
  const today = osloTodayISODate();

  const denyRole = requireRoleOr403(a.ctx, "orders.today.read", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const user_id = String(scope.userId ?? "").trim();
  const company_id = String(scope.companyId ?? "").trim();
  const location_id = String(scope.locationId ?? "").trim();

  const lock = lockedStateForDate(today);

  if (!user_id || !company_id) {
    return jsonOrder(a.ctx,
      409,
      orderBase({
        ok: false,
        rid,
        date: today,
        locked: lock.locked,
        cutoffTime: lock.cutoffTime,
        menuAvailable: true,
        canAct: false,
        error: "SCOPE_MISSING",
        message: "Mangler scope (user/company).",
        detail: null,
        receipt: null,
        order: null,
      } as any)
    );
  }
  if (!location_id) {
    return jsonOrder(a.ctx,
      409,
      orderBase({
        ok: false,
        rid,
        date: today,
        locked: lock.locked,
        cutoffTime: lock.cutoffTime,
        menuAvailable: true,
        canAct: false,
        error: "LOCATION_MISSING",
        message: "Mangler lokasjonstilknytning (location_id).",
        detail: null,
        receipt: null,
        order: null,
      } as any)
    );
  }

  try {
    const sb = await supabaseServer();

    const { data: order, error: oErr } = await sb
      .from("orders")
      .select("id,status,date,created_at,updated_at,note,company_id,location_id")
      .eq("user_id", user_id)
      .eq("date", today)
      .eq("company_id", company_id)
      .eq("location_id", location_id)
      .maybeSingle();

    if (oErr) {
      return jsonOrder(a.ctx,
        500,
        orderBase({
          ok: false,
          rid,
          date: today,
          locked: lock.locked,
          cutoffTime: lock.cutoffTime,
          menuAvailable: true,
          canAct: false,
          error: "DB_ERROR",
          message: "Kunne ikke hente ordrestatus.",
          detail: { error: oErr?.message ?? String(oErr) },
          receipt: null,
          order: null,
        } as any)
      );
    }

    return jsonOrder(a.ctx,
      200,
      orderBase({
        ok: true,
        rid,
        date: today,
        locked: lock.locked,
        cutoffTime: lock.cutoffTime,
        menuAvailable: true,
        canAct: !lock.locked,
        error: null,
        message: null,
        receipt: order?.id ? receiptFor(order.id, String(order.status ?? "unknown"), order.updated_at ?? order.created_at ?? new Date().toISOString()) : null,
        order: order ?? null,
      } as any)
    );
  } catch (e: any) {
    return jsonOrder(a.ctx,
      500,
      orderBase({
        ok: false,
        rid,
        date: today,
        locked: lock.locked,
        cutoffTime: lock.cutoffTime,
        menuAvailable: true,
        canAct: false,
        error: "SERVER_ERROR",
        message: e?.message ?? "Ukjent feil.",
        detail: { at: "orders/today" },
        receipt: null,
        order: null,
      } as any)
    );
  }
}










