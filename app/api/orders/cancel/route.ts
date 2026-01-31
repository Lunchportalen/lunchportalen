// app/api/orders/cancel/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

// ✅ Oslo single source of truth
import { isIsoDate, cutoffStatusForDate } from "@/lib/date/oslo";

// ✅ Backup mail (failsafe)
import { sendOrderBackup } from "@/lib/orders/orderBackup";

// ✅ MUST audit (lukket sirkel)
import { auditWriteMust } from "@/lib/audit/auditWrite";

/* =========================================================
   Helpers
========================================================= */

function nowIso() {
  return new Date().toISOString();
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

function isoWeekday(isoDate: string): number | null {
  try {
    const d = new Date(`${isoDate}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return null;
    const day = d.getUTCDay(); // 0=Sun..6=Sat
    return day === 0 ? 7 : day;
  } catch {
    return null;
  }
}

/**
 * Midlertidig (Dag 2): pricing må finnes i respons for UI-kvittering.
 */
function pricingFallback(isoDate: string): { tier: "BASIS" | "LUXUS"; unit_price: number } {
  const wd = isoWeekday(isoDate);
  if (wd === 5) return { tier: "LUXUS", unit_price: 130 };
  return { tier: "BASIS", unit_price: 90 };
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

async function setCancelled(sb: any, input: { company_id: string; user_id: string; isoDate: string; note: string | null; slot?: string | null }) {
  const updated_at = nowIso();

  const tryUpdate = async (statusValue: string) => {
    let q = sb
      .from("orders")
      .update({ status: statusValue, updated_at, ...(input.note !== null ? { note: input.note } : {}) })
      .eq("company_id", input.company_id)
      .eq("user_id", input.user_id)
      .eq("date", input.isoDate);

    if (input.slot) q = q.eq("slot", input.slot);

    return await q.select("id,date,status,created_at,updated_at,note,slot").maybeSingle();
  };

  // Prøv canonical først
  const r1 = await tryUpdate("CANCELLED");
  if (!r1.error && r1.data) return { ok: true as const, used: "CANCELLED" as const, row: r1.data as SavedOrder };

  // Fallback for eldre verdier (idempotent “uansett hva som lå før”)
  const r2 = await tryUpdate("canceled");
  if (!r2.error && r2.data) return { ok: true as const, used: "canceled" as const, row: r2.data as SavedOrder };

  const r3 = await tryUpdate("canceled");
  if (!r3.error && r3.data) return { ok: true as const, used: "canceled" as const, row: r3.data as SavedOrder };

  // Hvis ingen rad ble oppdatert → not found
  if (!r3.error && !r3.data) return { ok: false as const, notFound: true as const };

  return { ok: false as const, error: r3.error ?? r2.error ?? r1.error };
}

/* =========================================================
   Route
========================================================= */
export async function POST(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "orders.cancel", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const company_id = String(scope.companyId ?? "").trim();
  const user_id = String(scope.userId ?? "").trim();
  const location_id = String(scope.locationId ?? "").trim();

  if (!company_id || !user_id) return jsonErr(409, rid, "SCOPE_MISSING", "Mangler scope (user/company).");
  if (!location_id) return jsonErr(409, rid, "LOCATION_MISSING", "Mangler lokasjonstilknytning (location_id).");

  const sb = await supabaseServer();

  try {
    const body = await readJson(req);

    const isoDate = String(body?.date ?? body?.isoDate ?? body?.day ?? "").trim();
    const note = normNote(body?.note);
    const slot = normSlot(body?.slot);

    if (!isIsoDate(isoDate)) {
      return jsonErr(400, rid, "INVALID_DATE", "Ugyldig dato (YYYY-MM-DD).", { date: isoDate });
    }

    const cutoff = cutoffStatusForDate(isoDate);
    if (cutoff === "PAST") {
      return jsonErr(403, rid, "DATE_LOCKED_PAST", "Datoen er passert og kan ikke endres.", { date: isoDate });
    }
    if (cutoff === "TODAY_LOCKED") {
      return jsonErr(403, rid, "CUTOFF_LOCKED", "Endringer er låst etter kl. 08:00 i dag.", { date: isoDate, cutoff: "08:00" });
    }

    // Firmastatus (service role) – fail-closed
  const admin = await adminClientOrNull();
    if (!admin) {
      return jsonErr(500, rid, "CONFIG_ERROR", "Mangler service role konfigurasjon for firmastatus/audit.", {
        missing: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL"],
      });
    }

    const cRes = await admin.from("companies").select("id,status").eq("id", company_id).maybeSingle();
    if (cRes.error || !cRes.data) {
      return jsonErr(500, rid, "COMPANY_LOOKUP_FAILED", "Kunne ikke lese firmastatus.", { error: cRes.error?.message ?? null });
    }

    const companyStatus = normCompanyStatus((cRes.data as any).status);
    const entity_id = `${company_id}:${location_id}:${user_id}:${isoDate}${slot ? `:${slot}` : ""}`;

    // Enforcement: cancel blocked hvis firma ikke er ACTIVE
    if (companyStatus !== "ACTIVE") {
      const reason =
        companyStatus === "PAUSED" ? "COMPANY_PAUSED" : companyStatus === "CLOSED" ? "COMPANY_CLOSED" : "COMPANY_NOT_ACTIVE";

      try {
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
      } catch (e: any) {
        return jsonErr(500, rid, "AUDIT_INSERT_FAILED", "Kunne ikke logge enforcement-block. Avbryter for å bevare fasit.", {
          reason,
          company_status: companyStatus,
          audit_error: String(e?.message ?? e ?? "Unknown audit error"),
        });
      }

      return jsonErr(403, rid, reason, "Avbestilling er låst pga firmastatus.", { company_status: companyStatus });
    }

    // Apply cancel (idempotent)
    const cancelled = await setCancelled(sb, { company_id, user_id, isoDate, note, slot });

    if (!cancelled.ok) {
      if ((cancelled as any).notFound) {
        // Best-effort audit (MUST)
        try {
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
        } catch (e: any) {
          return jsonErr(500, rid, "AUDIT_INSERT_FAILED", "Kunne ikke logge cancel-not-found. Avbryter for å bevare fasit.", {
            audit_error: String(e?.message ?? e ?? "Unknown audit error"),
          });
        }

        return jsonErr(404, rid, "ORDER_NOT_FOUND", "Ingen bestilling å avbestille.", { date: isoDate, slot });
      }

      try {
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
      } catch (e: any) {
        return jsonErr(500, rid, "AUDIT_INSERT_FAILED", "Kunne ikke logge cancel-feil. Avbryter for å bevare fasit.", {
          audit_error: String(e?.message ?? e ?? "Unknown audit error"),
        });
      }

      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke avbestille.", {
        error: String((cancelled as any)?.error?.message ?? (cancelled as any)?.error ?? "unknown"),
      });
    }

    // Backup mail (failsafe – må ikke stoppe user flow)
    const pricing = pricingFallback(isoDate);
    const backup = await sendOrderBackup({
      rid,
      action: "CANCEL",
      status: "CANCELLED",
      orderId: cancelled.row?.id ?? null,
      date: isoDate,
      slot: cancelled.row?.slot ?? slot ?? null,
      user_id,
      company_id,
      location_id,
      actor_email: scope.email ?? null,
      actor_role: scope.role ?? null,
      note: cancelled.row?.note ?? note ?? null,
      extra: { route: "/api/orders/cancel", pricing },
    });

    // MUST audit: backup result
    try {
      await auditWriteMust({
        rid,
        action: backup.ok ? "ORDER_BACKUP_SENT" : "ORDER_BACKUP_FAILED",
        entity_type: "order",
        entity_id: cancelled.row?.id ?? entity_id,
        company_id,
        location_id,
        actor_user_id: user_id,
        actor_email: scope.email ?? null,
        actor_role: scope.role ?? null,
        summary: backup.ok ? "Backup email sent" : "Backup email failed",
        detail: { route: "/api/orders/cancel", date: isoDate, slot, backup },
      });
    } catch (e: any) {
      return jsonErr(500, rid, "AUDIT_INSERT_FAILED", "Kunne ikke logge backup-status. Avbryter for å bevare fasit.", {
        audit_error: String(e?.message ?? e ?? "Unknown audit error"),
      });
    }

    return jsonOk({
      ok: true,
      rid,
      order: {
        id: cancelled.row?.id ?? null,
        date: isoDate,
        status: "CANCELLED",
        note: cancelled.row?.note ?? note ?? null,
        slot: cancelled.row?.slot ?? slot ?? null,
        created_at: cancelled.row?.created_at ?? null,
        updated_at: cancelled.row?.updated_at ?? null,
        saved_at: nowIso(),
      },
      pricing,
      backup,
    });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", String(e?.message ?? "Unknown error"), { at: "orders/cancel" });
  }
}

