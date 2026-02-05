// app/api/kitchen/batch/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

// Dag-3 helpers
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { cutoffStatusForDate0805, osloTodayISODate } from "@/lib/date/oslo";

type AllowedRole = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type BatchStatus = "queued" | "packed" | "delivered";

// ✅ kitchen + superadmin only
const allowedRoles = ["kitchen", "superadmin"] as const satisfies readonly AllowedRole[];
const allowedStatus = new Set<BatchStatus>(["queued", "packed", "delivered"]);

function rankStatus(s: BatchStatus) {
  if (s === "delivered") return 2;
  if (s === "packed") return 1;
  return 0;
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isIsoDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}

function cutoffAllowed(dateISO: string) {
  const status = cutoffStatusForDate0805(dateISO);
  if (status === "TODAY_LOCKED") return { ok: true as const };
  if (status === "PAST") return { ok: false as const, code: "DATE_LOCKED_PAST", message: "Datoen er passert og kan ikke endres." };
  return { ok: false as const, code: "LOCKED_AFTER_0805", message: "Statusendring er kun tillatt etter kl. 08:05 i dag." };
}

/**
 * PATCH /api/kitchen/batch
 * Body (NEW + backward compatible):
 * - date OR delivery_date (YYYY-MM-DD)
 * - slot OR delivery_window (string)
 * - location_id OR company_location_id (uuid/string)
 * - status: queued|packed|delivered OR QUEUED|PACKED|DELIVERED
 *
 * Upsert på (delivery_date, delivery_window, company_location_id)
 * Table: delivery_batches
 *
 * Behavior:
 * - QUEUED: packed_at=null, delivered_at=null
 * - PACKED: packed_at=now (if missing), delivered_at=null
 * - DELIVERED: packed_at=now (if missing), delivered_at=now
 */
export async function PATCH(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  // 1) Auth gate (401) — scopeOr401: Response | { ok:true, ctx }
  const scoped = await scopeOr401(req);
  if (scoped.ok === false) return scoped.res;
  const ctx = scoped.ctx;

  // 2) Role gate (403) — requireRoleOr403: Response | void/null
  const denied = requireRoleOr403(ctx, allowedRoles);
  if (denied instanceof Response) return denied;

  // 3) Safe JSON (aldri throw)
  const body = await readJson(req);

  // ✅ accept both old and new field names
  const delivery_date = safeStr(body?.delivery_date ?? body?.date);
  const delivery_window = safeStr(body?.delivery_window ?? body?.slot);
  const company_location_id = safeStr(body?.company_location_id ?? body?.location_id);

  // ✅ accept both lowercase and UPPERCASE status
  const statusRaw = safeStr(body?.status);
  const statusLower = statusRaw.toLowerCase();

  const status: BatchStatus =
    statusLower === "delivered" || statusLower === "delivered_at" || statusLower === "levert"
      ? "delivered"
      : statusLower === "packed" || statusLower === "pakket"
      ? "packed"
      : statusLower === "queued" || statusLower === "queue" || statusLower === "klar"
      ? "queued"
      : (statusLower as BatchStatus);

  if (!delivery_date || !delivery_window || !company_location_id || !statusRaw) {
    return jsonErr(ctx.rid, "Missing fields.", 400, { code: "BAD_REQUEST", detail: {
      required_any_of: [
        ["date", "slot", "location_id", "status"],
        ["delivery_date", "delivery_window", "company_location_id", "status"],
      ],
      got: {
        delivery_date,
        delivery_window,
        company_location_id,
        status: statusRaw,
      },
    } });
  }

  if (!isIsoDate(delivery_date)) {
    return jsonErr(ctx.rid, "Invalid delivery_date (expected YYYY-MM-DD).", 400, { code: "BAD_REQUEST", detail: {
      delivery_date,
    } });
  }
  if (safeStr(ctx?.scope?.role).toLowerCase() === "kitchen" && delivery_date !== osloTodayISODate()) {
    return jsonErr(ctx.rid, "Kjøkken kan kun endre dagens status.", 400, { code: "FORBIDDEN_DATE", detail: {
      date: delivery_date,
      today: osloTodayISODate(),
    } });
  }

  const cutoff = cutoffAllowed(delivery_date);
  if (!cutoff.ok) {
    return jsonErr(ctx.rid, cutoff.message, 423, { code: cutoff.code, detail: { date: delivery_date, cutoff: "08:05" } });
  }

  if (!allowedStatus.has(status)) {
    return jsonErr(ctx.rid, "Invalid status.", 400, { code: "BAD_REQUEST", detail: {
      status: statusRaw,
      normalized: status,
      allowed: Array.from(allowedStatus),
    } });
  }

  // 4) Profile scope (tenant binding)
  const userId = safeStr(ctx?.scope?.userId);
  if (!userId) return jsonErr(ctx.rid, "Mangler bruker.", 403, "FORBIDDEN");

  const admin = supabaseAdmin();
  const { data: prof, error: profErr } = await admin
    .from("profiles")
    .select("company_id, location_id, disabled_at, is_active")
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();

  if (profErr || !prof) return jsonErr(ctx.rid, "Mangler profil.", 403, "FORBIDDEN");
  if ((prof as any).disabled_at || (prof as any).is_active === false) {
    return jsonErr(ctx.rid, "Bruker er deaktivert.", 403, "FORBIDDEN");
  }

  const companyId = safeStr((prof as any).company_id);
  const locationId = safeStr((prof as any).location_id);
  if (!companyId) return jsonErr(ctx.rid, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");

  if (locationId && company_location_id !== locationId) {
    return jsonErr(ctx.rid, "Ugyldig lokasjon.", 403, "FORBIDDEN");
  }

  const { data: locRow, error: locErr } = await admin
    .from("company_locations")
    .select("id, company_id")
    .eq("id", company_location_id)
    .maybeSingle();

  if (locErr || !locRow?.id || safeStr((locRow as any).company_id) !== companyId) {
    return jsonErr(ctx.rid, "Lokasjon tilhører ikke firmaet.", 403, "FORBIDDEN");
  }

  // 5) Timestamps
  const now = new Date().toISOString();
  const patch: {
    status: BatchStatus;
    updated_at: string;
    packed_at?: string | null;
    delivered_at?: string | null;
  } = { status, updated_at: now };

  if (status === "queued") {
    patch.packed_at = null;
    patch.delivered_at = null;
  } else if (status === "packed") {
    // set packed_at to now (idempotent enough for MVP)
    patch.packed_at = now;
    patch.delivered_at = null;
  } else {
    // delivered: ensure packed_at exists too
    patch.packed_at = now;
    patch.delivered_at = now;
  }

  if (status !== "packed") {
    return jsonErr(ctx.rid, "Kjøkken kan kun sette status PACKED.", 400, "FORBIDDEN_STATUS");
  }

  // 6) Upsert (service role)
  // 6.1) Monotonic guard (no back)
  try {
    const { data: existing } = await admin
      .from("delivery_batches")
      .select("status")
      .eq("delivery_date", delivery_date)
      .eq("delivery_window", delivery_window)
      .eq("company_location_id", company_location_id)
      .maybeSingle();

    const prevRaw = String((existing as any)?.status ?? "").toLowerCase();
    if (prevRaw) {
      const prev = prevRaw as BatchStatus;
      if (allowedStatus.has(prev)) {
        if (rankStatus(status) < rankStatus(prev)) {
          return jsonErr(ctx.rid, `Kan ikke gå fra ${prev} til ${status}.`, 400, "MONOTONIC_VIOLATION");
        }
      }
    }
  } catch {
    return jsonErr(ctx.rid, "Kunne ikke verifisere eksisterende batch-status.", 400, "DB_ERROR");
  }

  const { error } = await admin
    .from("delivery_batches")
    .upsert(
      {
        delivery_date,
        delivery_window,
        company_location_id,
        ...patch,
      },
      { onConflict: "delivery_date,delivery_window,company_location_id" }
    );

  if (error) {
    return jsonErr(ctx.rid, "Could not update batch.", 400, { code: "DB_ERROR", detail: {
      code: error.code,
      msg: error.message,
    } });
  }

  // 7) Response
  return jsonOk(ctx.rid, {
    delivery_date,
    delivery_window,
    company_location_id,
    status,
    updated_at: patch.updated_at,
    packed_at: patch.packed_at ?? null,
    delivered_at: patch.delivered_at ?? null,
  });
}
