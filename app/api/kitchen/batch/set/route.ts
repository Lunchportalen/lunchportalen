// app/api/kitchen/batch/set/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { cutoffStatusForDate0805, osloTodayISODate } from "@/lib/date/oslo";
import { auditWriteMust } from "@/lib/audit/auditWrite";
import { loadProfileByUserId } from "@/lib/db/profileLookup";

/**
 * POST /api/kitchen/batch/set
 * - Status setter (kitchen-only)
 * - Must NOT create batch; only update existing
 * - Status flow: QUEUED -> PACKED (idempotent on PACKED)
 */

function isIsoDate(v: any) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));
}
function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normSlot(v: any) {
  const s = safeStr(v).toLowerCase();
  return s || "lunch";
}
type BatchStatus = "QUEUED" | "PACKED" | "DELIVERED";
function normStatus(v: any): BatchStatus | null {
  const s = safeStr(v).toUpperCase();
  if (s === "QUEUED" || s === "PACKED" || s === "DELIVERED") return s;
  return null;
}
function nowIso() {
  return new Date().toISOString();
}
function entityKey(date: string, slot: string, location_id: string) {
  return `${date}__${slot}__${location_id}`;
}

type KitchenBatchRow = {
  id?: string | null;
  delivery_date: string;
  delivery_window: string;
  company_location_id: string;
  status: string | null;
  packed_at: string | null;
  delivered_at: string | null;
};

function cutoffAllowed(dateISO: string) {
  const status = cutoffStatusForDate0805(dateISO);
  if (status === "TODAY_LOCKED") return { ok: true as const };
  if (status === "PAST") return { ok: false as const, code: "DATE_LOCKED_PAST", message: "Datoen er passert og kan ikke endres." };
  return { ok: false as const, code: "LOCKED_BEFORE_0805", message: "Statusendring er kun tillatt etter kl. 08:05 i dag." };
}

export async function POST(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  // ? Guard: scope + rid
  const a = await scopeOr401(req);
  if ((a as any)?.ok === false) return (a as any).res;

  const { rid, scope } = (a as any).ctx;

  // ? Role gate (kitchen only)
  const denyRole = requireRoleOr403((a as any).ctx, "kitchen.batch.set", ["kitchen"]);
  if (denyRole) return denyRole;

  // ? Confirm cookie-session (Avensia: fail closed)
  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");

  // ? Service role for update
  let admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(rid, "Service role mangler.", 500, { code: "CONFIG_ERROR", detail: { detail: safeStr(e?.message ?? e) } });
  }

  try {
    // ? Read body (kan returnere Response i ditt oppsett)
    const bodyOrRes = await readJson(req);
    if (bodyOrRes instanceof Response) return bodyOrRes;
    const body = bodyOrRes as any;

    const dateRaw = safeStr(body?.date) || osloTodayISODate();
    const date = isIsoDate(dateRaw) ? dateRaw : "";
    const slot = normSlot(body?.slot);
    const location_id = safeStr(body?.location_id);
    const wanted = normStatus(body?.status);

    if (!date) return jsonErr(rid, "Ugyldig dato.", 400, { code: "INVALID_DATE", detail: { date: dateRaw } });
    if (date !== osloTodayISODate()) {
      return jsonErr(rid, "Kjøkken kan kun endre dagens status.", 403, { code: "FORBIDDEN_DATE", detail: { date, today: osloTodayISODate() } });
    }
    if (!location_id) return jsonErr(rid, "Mangler location_id.", 400, "MISSING_LOCATION");
    if (!wanted) return jsonErr(rid, "Ugyldig status.", 400, { code: "INVALID_STATUS", detail: { status: body?.status } });

    const cutoff = cutoffAllowed(date);
    if (!cutoff.ok) {
      return jsonErr(rid, cutoff.message, 412, { code: cutoff.code, detail: { date, cutoff: "08:05" } });
    }

    // ?? Kun PACKED er tillatt i dette endepunktet
    if (wanted !== "PACKED") {
      return jsonErr(rid, "Kjøkken kan kun sette status PACKED.", 422, "FORBIDDEN_STATUS");
    }

    const userId = safeStr(auth?.user?.id) || safeStr(scope?.userId);
    const { data: prof, error: profErr } = await loadProfileByUserId(admin as any, userId, "company_id, location_id, disabled_at, is_active");

    if (profErr) return jsonErr(rid, "Kunne ikke hente profil.", 500, { code: "DB_ERROR", detail: { message: profErr.message, code: (profErr as any).code ?? null } });
    if (!prof) return jsonErr(rid, "Mangler profil.", 403, "FORBIDDEN");
    if ((prof as any).disabled_at || (prof as any).is_active === false) {
      return jsonErr(rid, "Bruker er deaktivert.", 403, "FORBIDDEN");
    }

    const companyId = safeStr((prof as any).company_id);
    const profileLocationId = safeStr((prof as any).location_id);
    if (!companyId) return jsonErr(rid, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");
    if (profileLocationId && location_id !== profileLocationId) {
      return jsonErr(rid, "Ugyldig lokasjon.", 403, "FORBIDDEN");
    }

    const { data: locRow, error: locErr } = await admin
      .from("company_locations")
      .select("id, company_id")
      .eq("id", location_id)
      .maybeSingle();

    if (locErr || !locRow?.id || safeStr((locRow as any).company_id) !== companyId) {
      return jsonErr(rid, "Lokasjon tilhører ikke firmaet.", 403, "FORBIDDEN");
    }

    const { data: existing, error: exErr } = await admin
      .from("kitchen_batch")
      .select("id,delivery_date,delivery_window,company_location_id,status,packed_at,delivered_at")
      .eq("delivery_date", date)
      .eq("delivery_window", slot)
      .eq("company_location_id", location_id)
      .maybeSingle<KitchenBatchRow>();

    if (exErr) {
      return jsonErr(rid, "Kunne ikke lese eksisterende batch.", 500, { code: "DB_ERROR", detail: {
        message: exErr.message,
        code: (exErr as any).code ?? null,
      } });
    }
    if (!existing) return jsonErr(rid, "Batch finnes ikke.", 404, { code: "NOT_FOUND", detail: { date, slot, location_id } });

    const prevStatusRaw = safeStr(existing?.status).toUpperCase();
    const prevStatus: BatchStatus =
      prevStatusRaw === "DELIVERED" || prevStatusRaw === "PACKED" || prevStatusRaw === "QUEUED"
        ? (prevStatusRaw as BatchStatus)
        : existing?.delivered_at
          ? "DELIVERED"
          : existing?.packed_at
            ? "PACKED"
            : "QUEUED";

    if (prevStatus === "DELIVERED") {
      return jsonErr(rid, "DELIVERED er endelig. Kan ikke endres.", 409, "MONOTONIC_VIOLATION");
    }

    // Idempotent: allerede PACKED
    if (prevStatus === "PACKED") {
      return jsonOk(rid, {
          status: "PACKED",
          batch: {
            id: existing.id ?? null,
            delivery_date: existing.delivery_date,
            delivery_window: existing.delivery_window,
            company_location_id: existing.company_location_id,
            status: "PACKED",
            packed_at: existing.packed_at ?? null,
            delivered_at: existing.delivered_at ?? null,
          },
        }, 200);
    }

    if (prevStatus !== "QUEUED") {
      return jsonErr(rid, "Batch kan ikke endres fra nåværende status.", 422, { code: "INVALID_STATUS", detail: { status: prevStatus } });
    }

    const ts = nowIso();
    const packed_at = existing.packed_at ?? ts;

    // ? MUST audit (fail-closed) BEFORE write
    await auditWriteMust({
      rid,
      action: "kitchen_batch_set_status",
      entity_type: "order_batch",
      entity_id: entityKey(date, slot, location_id),
      company_id: companyId,
      location_id,
      actor_user_id: userId,
      actor_email: scope?.email ?? null,
      actor_role: scope?.role ?? null,
      summary: "Batch set PACKED",
      detail: {
        route: "/api/kitchen/batch/set",
        input: { date, slot, location_id, status: "PACKED" },
        before: {
          status: safeStr(existing.status).toUpperCase() || null,
          packed_at: existing.packed_at ?? null,
          delivered_at: existing.delivered_at ?? null,
        },
      },
    });

    let updateQ = admin
      .from("kitchen_batch")
      .update({ status: "PACKED", packed_at, delivered_at: existing.delivered_at ?? null })
      .eq("delivery_date", date)
      .eq("delivery_window", slot)
      .eq("company_location_id", location_id);

    updateQ = updateQ.eq("status", "QUEUED");

    const { data: saved, error: upErr } = await updateQ
      .select("id,delivery_date,delivery_window,company_location_id,status,packed_at,delivered_at")
      .maybeSingle<KitchenBatchRow>();

    if (upErr) {
      return jsonErr(rid, "Kunne ikke lagre batch.", 500, { code: "DB_ERROR", detail: {
        message: upErr?.message ?? null,
        code: (upErr as any)?.code ?? null,
      } });
    }

    if (!saved) {
      return jsonErr(rid, "Batch-status ble endret av en annen prosess.", 409, "RACE_CONDITION");
    }

    return jsonOk(rid, {
        status: "PACKED",
        batch: {
          id: saved.id ?? null,
          delivery_date: saved.delivery_date,
          delivery_window: saved.delivery_window,
          company_location_id: saved.company_location_id,
          status: "PACKED",
          packed_at: saved.packed_at ?? null,
          delivered_at: saved.delivered_at ?? null,
        },
      }, 200);
  } catch (e: any) {
    return jsonErr(rid, safeStr(e?.message ?? e), 500, { code: "UNHANDLED", detail: { at: "kitchen/batch/set" } });
  }
}


