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

// ✅ MUST audit (lukket sirkel)
import { auditWriteMust } from "@/lib/audit/auditWrite";
import { auditSafe } from "@/lib/ops/auditSafe";
import { requireRule } from "@/lib/agreement/requireRule";
import { lpOrderCancel } from "@/lib/orders/rpcWrite";

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

function weekdayKeyOslo(isoDate: string): "mon" | "tue" | "wed" | "thu" | "fri" | null {
  try {
    const d = new Date(`${isoDate}T12:00:00Z`);
    const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
    const map: Record<string, "mon" | "tue" | "wed" | "thu" | "fri"> = {
      Mon: "mon",
      Tue: "tue",
      Wed: "wed",
      Thu: "thu",
      Fri: "fri",
    };
    return map[wd] ?? null;
  } catch {
    return null;
  }
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
  const rpc = await lpOrderCancel(sb as any, { p_date: input.isoDate });
  if (!rpc.ok) {
    return { ok: false as const, error: rpc.error, code: rpc.code };
  }

  let q = sb
    .from("orders")
    .select("id,date,status,created_at,updated_at,note,slot")
    .eq("company_id", input.company_id)
    .eq("user_id", input.user_id)
    .eq("date", input.isoDate);

  if (input.slot) q = q.eq("slot", input.slot);

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
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "orders.cancel", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const company_id = String(scope.companyId ?? "").trim();
  const user_id = String(scope.userId ?? "").trim();
  const location_id = String(scope.locationId ?? "").trim();

  if (!company_id || !user_id) return jsonErr(rid, "Mangler scope (user/company).", 409, "SCOPE_MISSING");
  if (!location_id) return jsonErr(rid, "Mangler lokasjonstilknytning (location_id).", 409, "LOCATION_MISSING");

  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();

  try {
    const body = await readJson(req);

    const isoDate = String(body?.date ?? body?.isoDate ?? body?.day ?? "").trim();
    const note = normNote(body?.note);
    const slot = normSlot(body?.slot);

    if (!isIsoDate(isoDate)) {
      return jsonErr(rid, "Ugyldig dato (YYYY-MM-DD).", 400, { code: "INVALID_DATE", detail: { date: isoDate } });
    }

    // Firmastatus (service role) — fail-closed
    const admin = await adminClientOrNull();
    if (!admin) {
      return jsonErr(rid, "Mangler service role konfigurasjon for firmastatus/audit.", 500, {
        code: "CONFIG_ERROR",
        detail: {
          missing: ["service role client", "supabase url"],
        },
      });
    }

    const cRes = await admin.from("companies").select("id,status").eq("id", company_id).maybeSingle();
    if (cRes.error || !cRes.data) {
      return jsonErr(rid, "Kunne ikke lese firmastatus.", 500, {
        code: "COMPANY_LOOKUP_FAILED",
        detail: { error: cRes.error?.message ?? null },
      });
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

      return jsonErr(rid, "Avbestilling er låst pga firmastatus.", 403, {
        code: reason,
        detail: { company_status: companyStatus },
      });
    }

    // Cutoff enforcement (Oslo)
    const cutoff = cutoffStatusForDate(isoDate);
    if (cutoff === "PAST") {
      return jsonErr(rid, "Datoen er passert og kan ikke endres.", 403, {
        code: "DATE_LOCKED_PAST",
        detail: { date: isoDate },
      });
    }
    if (cutoff === "TODAY_LOCKED") {
      return jsonErr(rid, "Endringer er låst etter kl. 08:00 i dag.", 403, {
        code: "CUTOFF_LOCKED",
        detail: { date: isoDate, cutoff: "08:00" },
      });
    }

    const dayKey = weekdayKeyOslo(isoDate);
    if (!dayKey) return jsonErr(rid, "Ugyldig ukedag.", 400, { code: "INVALID_DAY", detail: { date: isoDate } });

    // Agreement rule enforcement (fail-closed)
    const ruleSlot = slot ?? "lunch";
    const ruleRes = await requireRule({ sb: admin as any, companyId: company_id, dayKey, slot: ruleSlot, rid });
    if (!ruleRes.ok) {
      const err = ruleRes as { status: number; error: string; message: string };
      return jsonErr(rid, err.message, err.status ?? 400, err.error);
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
        return jsonErr(rid, "Ingen bestilling å avbestille.", 404, { code: "ORDER_NOT_FOUND", detail: { date: isoDate, slot } });
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

      return jsonErr(rid, "Kunne ikke avbestille.", 500, {
        code: "DB_ERROR",
        detail: { error: String((cancelled as any)?.error?.message ?? (cancelled as any)?.error ?? "unknown") },
      });
    }

    // Backup mail (failsafe — må ikke stoppe user flow)
    const pricing = pricingFallback(isoDate);
    const backup = { ok: true, skipped: "outbox_db_trigger" } as const;

    return jsonOk(rid, {
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
    return jsonErr(rid, String(e?.message ?? "Unknown error"), 500, {
      code: "UNHANDLED",
      detail: { at: "orders/cancel" },
    });
  }
}







