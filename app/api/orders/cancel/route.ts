// app/api/orders/cancel/route.ts
// DEPRECATED — do not use for new UI/client code. Canonical employee cancel HTTP entry: POST /api/order/cancel (lib/api/client cancelOrder).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* agents-ci: JSON responses include ok: true, rid: (success) and ok: false, rid: (errors) via jsonOrderWrite*. */

import type { NextRequest } from "next/server";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { coerceOrderWriteErrorResponse, jsonOrderWriteErr, jsonOrderWriteOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

// ✅ Oslo single source of truth
import { isIsoDate, cutoffStatusForDate } from "@/lib/date/oslo";

// ✅ Backup mail (failsafe)

// ✅ MUST audit (lukket sirkel)
import { auditWriteMust } from "@/lib/audit/auditWrite";
import { auditSafe } from "@/lib/ops/auditSafe";
import { assertCompanyOrderWriteAllowed } from "@/lib/orders/companyOrderEligibility";
import { assertOrderWithinAgreementPreflight } from "@/lib/orders/orderWriteGuard";
import { lpOrderCancel, normalizeOrderTableSlot } from "@/lib/orders/rpcWrite";
import { fanoutLpOrderSetOutboxBestEffort } from "@/lib/orderBackup/outbox";

/* =========================================================
   Helpers
========================================================= */

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

function normNote(v: any): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function normSlot(v: any): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  return s ? s : null;
}

/* =========================================================
   Cancel write (idempotent)
   lp_order_set(CANCEL) is idempotent: repeated cancel same date/slot
   yields same outcome, no duplicate outbox (event_key dedup).
========================================================= */

type SavedOrder = {
  id: string;
  date: string;
  status: any;
  created_at: string | null;
  updated_at: string | null;
  note: string | null;
  slot: string | null;
};

async function setCancelled(
  sb: any,
  input: { company_id: string; user_id: string; isoDate: string; slot?: string | null }
) {
  const orderSlot = normalizeOrderTableSlot(input.slot);
  const rpc = await lpOrderCancel(sb as any, { p_date: input.isoDate, p_slot: orderSlot });
  if (!rpc.ok) {
    return { ok: false as const, error: rpc.error, code: rpc.code };
  }

  const q = sb
    .from("orders")
    .select("id,date,status,created_at,updated_at,note,slot")
    .eq("company_id", input.company_id)
    .eq("user_id", input.user_id)
    .eq("date", input.isoDate)
    .eq("slot", orderSlot);

  const row = await q.maybeSingle();
  if (row.error) {
    return { ok: false as const, error: row.error, code: "ORDER_READ_FAILED" };
  }
  if (!row.data) {
    return { ok: false as const, notFound: true as const };
  }

  return { ok: true as const, row: row.data as SavedOrder };
}

/* =========================================================
   Route
========================================================= */

export async function POST(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return await coerceOrderWriteErrorResponse(a.res ?? a.response);

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "orders.cancel", ["employee", "company_admin"]);
  if (denyRole) return await coerceOrderWriteErrorResponse(denyRole);

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return await coerceOrderWriteErrorResponse(denyScope);

  const company_id = String(scope.companyId ?? "").trim();
  const user_id = String(scope.userId ?? "").trim();
  const location_id = String(scope.locationId ?? "").trim();

  if (!company_id || !user_id) return jsonOrderWriteErr(rid, 409, "SCOPE_MISSING", "Mangler scope (user/company).");
  if (!location_id) return jsonOrderWriteErr(rid, 409, "LOCATION_MISSING", "Mangler lokasjonstilknytning (location_id).");

  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();

  try {
    const body = await readJson(req);

    const isoDate = String(body?.date ?? body?.isoDate ?? body?.day ?? "").trim();
    const note = normNote(body?.note);
    const slot = normSlot(body?.slot);

    if (!isIsoDate(isoDate)) {
      return jsonOrderWriteErr(rid, 400, "INVALID_DATE", "Ugyldig dato (YYYY-MM-DD).");
    }

    // Firmastatus (service role) — fail-closed
    const admin = await adminClientOrNull();
    if (!admin) {
      return jsonOrderWriteErr(rid, 500, "CONFIG_ERROR", "Mangler service role konfigurasjon for firmastatus/audit.");
    }

    const cRes = await admin.from("companies").select("id,status").eq("id", company_id).maybeSingle();
    if (cRes.error || !cRes.data) {
      return jsonOrderWriteErr(rid, 500, "COMPANY_LOOKUP_FAILED", "Kunne ikke lese firmastatus.");
    }

    const companyStatus = normCompanyStatus((cRes.data as any).status);
    const entity_id = `${company_id}:${location_id}:${user_id}:${isoDate}${slot ? `:${slot}` : ""}`;

    // Enforcement: cancel blocked hvis firma ikke er ACTIVE
    if (companyStatus !== "ACTIVE") {
      const reason =
        companyStatus === "PAUSED"
          ? "COMPANY_PAUSED"
          : companyStatus === "CLOSED"
            ? "COMPANY_CLOSED"
            : "COMPANY_NOT_ACTIVE";

      await auditSafe(
        async () => {
          await auditWriteMust({
            rid,
            action: "ENFORCEMENT_BLOCK",
            entity_type: "order",
            entity_id,
            company_id,
            location_id,
            actor_user_id: user_id,
            actor_email: scope.email ?? null,
            actor_role: scope.role ?? null,
            summary: reason,
            detail: { route: "/api/orders/cancel", intent: "CANCEL", date: isoDate, slot, company_status: companyStatus },
          });
        },
        rid
      );

      return jsonOrderWriteErr(rid, 403, reason, "Avbestilling er låst pga firmastatus.");
    }

    // Cutoff enforcement (Oslo)
    const cutoff = cutoffStatusForDate(isoDate);
    if (cutoff === "PAST") {
      return jsonOrderWriteErr(rid, 403, "DATE_LOCKED_PAST", "Datoen er passert og kan ikke endres.");
    }
    if (cutoff === "TODAY_LOCKED") {
      return jsonOrderWriteErr(rid, 403, "CUTOFF_LOCKED", "Endringer er låst etter kl. 08:00 i dag.");
    }

    const hold = await assertCompanyOrderWriteAllowed(sb, company_id, rid);
    if (hold.ok === false) {
      return jsonOrderWriteErr(rid, hold.status, hold.code, hold.message);
    }

    const ruleSlot = slot ?? "lunch";
    const pre = await assertOrderWithinAgreementPreflight({
      sb: admin as any,
      companyId: company_id,
      locationId: location_id || null,
      orderIsoDate: isoDate,
      agreementRuleSlot: ruleSlot,
      rid,
      action: "CANCEL",
    });
    if (pre.ok === false) {
      return jsonOrderWriteErr(rid, pre.status, pre.code, pre.message);
    }

    // Apply cancel (idempotent)
    const cancelled = await setCancelled(sb, { company_id, user_id, isoDate, slot });

    if (!cancelled.ok) {
      if ((cancelled as any).notFound) {
        await auditSafe(
          async () => {
            await auditWriteMust({
              rid,
              action: "ORDER_CANCEL_NOT_FOUND",
              entity_type: "order",
              entity_id,
              company_id,
              location_id,
              actor_user_id: user_id,
              actor_email: scope.email ?? null,
              actor_role: scope.role ?? null,
              summary: "No order to cancel",
              detail: { route: "/api/orders/cancel", date: isoDate, slot },
            });
          },
          rid
        );

        // Idempotent UX: returning 200 with a "noop" is often better, but you asked for strict.
        return jsonOrderWriteErr(rid, 404, "ORDER_NOT_FOUND", "Ingen bestilling å avbestille.");
      }

      await auditSafe(
        async () => {
          await auditWriteMust({
            rid,
            action: "ORDER_CANCEL_FAILED",
            entity_type: "order",
            entity_id,
            company_id,
            location_id,
            actor_user_id: user_id,
            actor_email: scope.email ?? null,
            actor_role: scope.role ?? null,
            summary: "Cancel DB error",
            detail: {
              route: "/api/orders/cancel",
              date: isoDate,
              slot,
              error: String((cancelled as any)?.error?.message ?? (cancelled as any)?.error ?? "unknown"),
            },
          });
        },
        rid
      );

      return jsonOrderWriteErr(rid, 500, "DB_ERROR", "Kunne ikke avbestille.");
    }

    const orderId = String(cancelled.row?.id ?? "").trim();
    if (!orderId) {
      return jsonOrderWriteErr(rid, 500, "ORDER_CANCEL_BAD_RESPONSE", "Kunne ikke verifisere avbestilling.");
    }

    const orderSlot = normalizeOrderTableSlot(slot);
    await fanoutLpOrderSetOutboxBestEffort({ userId: user_id, date: isoDate, slot: orderSlot });

    return jsonOrderWriteOk(rid, {
      orderId,
      status: "cancelled",
      date: isoDate,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return jsonOrderWriteErr(rid, 500, "UNHANDLED", String(e?.message ?? "Unknown error"));
  }
}







