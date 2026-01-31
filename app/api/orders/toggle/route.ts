// app/api/orders/toggle/route.ts

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
   Input normalization
========================================================= */

type ToggleAction = "place" | "cancel";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normAction(v: any): ToggleAction | null {
  const s = safeStr(v).toLowerCase();
  if (s === "cancel" || s === "canceled") return "cancel";
  if (s === "place" || s === "active" || s === "order") return "place";
  return null;
}

function wantsLunchFromBody(body: any): boolean | null {
  if (typeof body?.wants_lunch === "boolean") return body.wants_lunch;
  if (typeof body?.wantsLunch === "boolean") return body.wantsLunch;

  if (typeof body?.wants_lunch === "string") {
    const s = safeStr(body.wants_lunch).toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  if (typeof body?.wantsLunch === "string") {
    const s = safeStr(body.wantsLunch).toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return null;
}

function isoWeekday(isoDate: string): number | null {
  try {
    const d = new Date(`${isoDate}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return null;
    const day = d.getUTCDay(); // 0=Sun..6=Sat
    if (day === 0) return 7;
    return day;
  } catch {
    return null;
  }
}

function normSlot(v: any): string {
  const s = safeStr(v).toLowerCase();
  return s || "lunch";
}

function normNote(v: any): string | null {
  const s = safeStr(v);
  return s ? s : null;
}

/**
 * Midlertidig: pricing må finnes i respons for UI-kvittering.
 * (Fasit senere: server pricing lookup per company/date)
 */
function pricingFallback(isoDate: string, body: any): { tier: "BASIS" | "LUXUS"; unit_price: number } {
  const bodyTier = safeStr(body?.tier ?? body?.pricing_tier ?? body?.pricing?.tier ?? "").toUpperCase();

  if (bodyTier === "LUXUS") return { tier: "LUXUS", unit_price: 130 };
  if (bodyTier === "BASIS") return { tier: "BASIS", unit_price: 90 };

  const wd = isoWeekday(isoDate);
  if (wd === 5) return { tier: "LUXUS", unit_price: 130 }; // fredag
  return { tier: "BASIS", unit_price: 90 };
}

/* =========================================================
   Company lifecycle (fail-closed)
========================================================= */

type CompanyLifecycle = "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING" | "UNKNOWN";
function normCompanyStatus(v: any): CompanyLifecycle {
  const s = safeStr(v).toUpperCase();
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

/* =========================================================
   Orders schema notes (fasit)
   orders columns: id, user_id, date, status, note, created_at, updated_at,
                   company_id, location_id, slot
========================================================= */

type OrderStatus = "ACTIVE" | "CANCELLED";

function normOrderStatus(v: any): OrderStatus {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  return "CANCELLED";
}

function mkEntityKey(company_id: string, location_id: string, user_id: string, isoDate: string, slot: string) {
  return `${company_id}:${location_id}:${user_id}:${isoDate}:${slot}`;
}

/* =========================================================
   Route
========================================================= */
export async function POST(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "orders.toggle", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const user_id = safeStr(scope.userId);
  const company_id = safeStr(scope.companyId);
  const location_id = safeStr(scope.locationId);

  if (!user_id || !company_id) return jsonErr(409, rid, "SCOPE_MISSING", "Mangler scope (user/company).");
  if (!location_id) return jsonErr(409, rid, "LOCATION_MISSING", "Mangler lokasjonstilknytning (location_id).");

  const sb = await supabaseServer();

  try {
    const body = await readJson(req);

    const isoDate = safeStr(body?.date ?? body?.isoDate ?? body?.day ?? "");
    const slot = normSlot(body?.slot);
    const note = normNote(body?.note);

    const wants = wantsLunchFromBody(body);
    const action: ToggleAction | null =
      normAction(body?.action ?? body?.intent ?? body?.status) ??
      (typeof wants === "boolean" ? (wants ? "place" : "cancel") : null);

    if (!isIsoDate(isoDate)) return jsonErr(400, rid, "INVALID_DATE", "Ugyldig dato (YYYY-MM-DD).", { date: isoDate });

    if (!action) {
      return jsonErr(409, rid, "BAD_REQUEST", "Mangler eller ugyldig action.", {
        hint: "action=place|cancel eller wantsLunch=true|false",
      });
    }

    // ✅ Cutoff enforcement (Oslo)
    const cutoff = cutoffStatusForDate(isoDate);
    if (cutoff === "PAST") {
      return jsonErr(403, rid, "DATE_LOCKED_PAST", "Datoen er passert og kan ikke endres.", { date: isoDate });
    }
    if (cutoff === "TODAY_LOCKED") {
      return jsonErr(403, rid, "CUTOFF_LOCKED", "Endringer er låst etter kl. 08:00 i dag.", {
        date: isoDate,
        cutoff: "08:00",
      });
    }

    // ✅ Firmastatus (service role)
  const admin = await adminClientOrNull();
    if (!admin) {
      return jsonErr(500, rid, "CONFIG_ERROR", "Mangler service role konfigurasjon for firmastatus/audit.", {
        missing: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL"],
      });
    }

    const cRes = await admin.from("companies").select("id,status").eq("id", company_id).maybeSingle();
    if (cRes.error || !cRes.data) {
      return jsonErr(500, rid, "COMPANY_LOOKUP_FAILED", "Kunne ikke lese firmastatus.", {
        error: cRes.error?.message ?? null,
      });
    }

    const companyStatus = normCompanyStatus((cRes.data as any).status);

    // ✅ Company lifecycle:
    // - place/cancel blocked hvis ikke ACTIVE
    // VIKTIG: enforcement-block skal alltid returnere 403 (ikke 500) selv om audit feiler
    if (companyStatus !== "ACTIVE") {
      const reason =
        companyStatus === "PAUSED"
          ? "COMPANY_PAUSED"
          : companyStatus === "CLOSED"
          ? "COMPANY_CLOSED"
          : companyStatus === "PENDING"
          ? "COMPANY_PENDING"
          : "COMPANY_NOT_ACTIVE";

      // MUST audit (best-effort i enforcement): audit-feil skal IKKE endre statuskode
      try {
        await auditWriteMust({
          rid,
          action: "ENFORCEMENT_BLOCK",
          entity_type: "order",
          entity_id: mkEntityKey(company_id, location_id, user_id, isoDate, slot),
          company_id,
          location_id,
          actor_user_id: user_id,
          actor_email: scope.email ?? null,
          actor_role: scope.role ?? null,
          summary: reason,
          detail: {
            route: "/api/orders/toggle",
            intent: action.toUpperCase(),
            date: isoDate,
            slot,
            company_status: companyStatus,
          },
        });
      } catch (e: any) {
        // ⚠️ fall-through til 403 uansett
        console.error(`[orders/toggle] audit enforcement failed rid=${rid}`, e?.message ?? e);
      }

      return jsonErr(403, rid, reason, "Handling er låst pga firmastatus.", {
        company_status: companyStatus,
        action,
      });
    }

    // ✅ Upsert-mål:
    // - Primær: (user_id, location_id, date, slot)
    // - Fallback: (company_id, user_id, date, slot)
    const nextStatus: OrderStatus = action === "place" ? "ACTIVE" : "CANCELLED";
    const savedAt = new Date().toISOString();
    const pricing = pricingFallback(isoDate, body);

    const payload = {
      user_id,
      company_id,
      location_id,
      date: isoDate,
      slot,
      note,
      status: nextStatus,
      updated_at: savedAt,
    };

    let saved:
      | {
          id: string;
          date: string;
          status: any;
          note: string | null;
          slot: string | null;
          created_at: string | null;
          updated_at: string | null;
        }
      | null = null;

    const r1 = await sb
      .from("orders")
      .upsert(payload, { onConflict: "user_id,location_id,date,slot" })
      .select("id,date,status,note,slot,created_at,updated_at")
      .maybeSingle();

    if (!r1.error && r1.data) {
      saved = r1.data as any;
    } else {
      const r2 = await sb
        .from("orders")
        .upsert(payload, { onConflict: "company_id,user_id,date,slot" })
        .select("id,date,status,note,slot,created_at,updated_at")
        .maybeSingle();

      if (r2.error || !r2.data) {
        return jsonErr(500, rid, "DB_ERROR", "Kunne ikke lagre.", {
          error: r2.error?.message ?? r1.error?.message ?? "Unknown DB error",
          hint: "Sjekk at det finnes unik constraint på onConflict-kolonnene.",
        });
      }
      saved = r2.data as any;
    }

    // MUST audit: order change (fail-closed)
    try {
      await auditWriteMust({
        rid,
        action: action === "place" ? "ORDER_PLACED" : "ORDER_CANCELLED",
        entity_type: "order",
        entity_id: saved.id,
        company_id,
        location_id,
        actor_user_id: user_id,
        actor_email: scope.email ?? null,
        actor_role: scope.role ?? null,
        summary: action === "place" ? "Order placed" : "Order cancelled",
        detail: {
          route: "/api/orders/toggle",
          date: isoDate,
          slot,
          nextStatus,
          note: saved.note ?? note ?? null,
          pricing,
        },
      });
    } catch (e: any) {
      return jsonErr(500, rid, "AUDIT_INSERT_FAILED", "Kunne ikke logge ordreendring. Avbryter for å bevare fasit.", {
        audit_error: String(e?.message ?? e ?? "Unknown audit error"),
      });
    }

    // Backup mail (failsafe – må ikke stoppe user flow)
    const backup = await sendOrderBackup({
      rid,
      action: action === "place" ? "PLACE" : "CANCEL",
      status: nextStatus,
      orderId: saved.id,
      date: isoDate,
      slot,
      user_id,
      company_id,
      location_id,
      actor_email: scope.email ?? null,
      actor_role: scope.role ?? null,
      note: saved.note ?? note ?? null,
      extra: { route: "/api/orders/toggle", pricing },
    });

    // MUST audit: backup result (fail-closed iht. fasit)
    try {
      await auditWriteMust({
        rid,
        action: backup.ok ? "ORDER_BACKUP_SENT" : "ORDER_BACKUP_FAILED",
        entity_type: "order",
        entity_id: saved.id,
        company_id,
        location_id,
        actor_user_id: user_id,
        actor_email: scope.email ?? null,
        actor_role: scope.role ?? null,
        summary: backup.ok ? "Backup email sent" : "Backup email failed",
        detail: {
          route: "/api/orders/toggle",
          date: isoDate,
          slot,
          nextStatus,
          backup,
        },
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
        id: saved.id,
        date: saved.date,
        status: normOrderStatus(saved.status),
        note: saved.note ?? null,
        slot: saved.slot ?? slot ?? null,
        created_at: saved.created_at ?? null,
        updated_at: saved.updated_at ?? null,
        saved_at: savedAt,
      },
      pricing,
      backup,
    });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", String(e?.message ?? "Unknown error"), { at: "orders/toggle" });
  }
}

