// app/api/kitchen/batch/set/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { jsonErr } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";
import { auditWriteMust } from "@/lib/audit/auditWrite";

/**
 * POST /api/kitchen/batch/set
 * - "smart" status setter (B6.4 MONOTONT):
 *   - QUEUED: ❌ forbudt (retur er ikke lov)
 *   - PACKED: setter packed_at hvis mangler
 *   - DELIVERED: setter packed_at hvis mangler, setter delivered_at
 *
 * Body:
 *  { date?: "YYYY-MM-DD", slot?: string, location_id: string, status: "PACKED"|"DELIVERED" }
 *
 * Table: kitchen_batch (ENTALL)
 * Unique: (delivery_date, delivery_window, company_location_id)
 *
 * MUST audit (fail-closed)
 */

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
function rankStatus(s: BatchStatus) {
  if (s === "DELIVERED") return 2;
  if (s === "PACKED") return 1;
  return 0;
}

type KitchenBatchRow = {
  delivery_date: string;
  delivery_window: string;
  company_location_id: string;
  status: string | null;
  packed_at: string | null;
  delivered_at: string | null;
};

export async function POST(req: NextRequest) {
  // ✅ Guard: scope + rid
  const a = await scopeOr401(req);
  if ((a as any)?.ok === false) return (a as any).res;

  const { rid, scope } = (a as any).ctx;

  // ✅ Role gate
  const denyRole = requireRoleOr403((a as any).ctx, "kitchen.batch.set", ["kitchen", "superadmin"]);
  if (denyRole) return denyRole;

  // ✅ Confirm cookie-session (Avensia: fail closed)
  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) return jsonErr(401, rid, "UNAUTHENTICATED", "Du må være innlogget.");

  // ✅ Service role for upsert
  let admin: ReturnType<typeof supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(500, rid, "CONFIG_ERROR", "Service role mangler.", { detail: safeStr(e?.message ?? e) });
  }

  try {
    // ✅ Read body (kan returnere Response i ditt oppsett)
    const bodyOrRes = await readJson(req);
    if (bodyOrRes instanceof Response) return bodyOrRes;
    const body = bodyOrRes as any;

    const dateRaw = safeStr(body?.date) || osloTodayISODate();
    const date = isIsoDate(dateRaw) ? dateRaw : "";
    const slot = normSlot(body?.slot);
    const location_id = safeStr(body?.location_id);
    const wanted = normStatus(body?.status);

    if (!date) return jsonErr(400, rid, "INVALID_DATE", "Ugyldig dato.", { date: dateRaw });
    if (!location_id) return jsonErr(400, rid, "MISSING_LOCATION", "Mangler location_id.");
    if (!wanted) return jsonErr(400, rid, "INVALID_STATUS", "Ugyldig status.", { status: body?.status });

    // 🔒 B6.4: forby eksplisitt QUEUED i input
    if (wanted === "QUEUED") {
      return jsonErr(409, rid, "MONOTONIC_VIOLATION", "QUEUED er ikke tillatt. Status kan ikke settes tilbake.");
    }

    // ✅ Fetch eksisterende row (for å bevare timestamps korrekt + monotonic check)
    const { data: existing, error: exErr } = await admin
      .from("kitchen_batch")
      .select("delivery_date,delivery_window,company_location_id,status,packed_at,delivered_at")
      .eq("delivery_date", date)
      .eq("delivery_window", slot)
      .eq("company_location_id", location_id)
      .maybeSingle<KitchenBatchRow>();

    if (exErr) {
      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke lese eksisterende batch.", {
        message: exErr.message,
        code: (exErr as any).code ?? null,
      });
    }

    // 🔒 B6.4: monotont løp
    // - DELIVERED er endelig
    // - Ingen tilbakegang (PACKED -> QUEUED allerede blokkert i input)
    const prevStatusRaw = safeStr(existing?.status).toUpperCase();
    const prevStatus: BatchStatus =
      prevStatusRaw === "DELIVERED" || prevStatusRaw === "PACKED" || prevStatusRaw === "QUEUED"
        ? (prevStatusRaw as BatchStatus)
        : existing?.delivered_at
          ? "DELIVERED"
          : existing?.packed_at
            ? "PACKED"
            : "QUEUED";

    // Ikke tillat nedgradering
    if (rankStatus(wanted) < rankStatus(prevStatus)) {
      return jsonErr(409, rid, "MONOTONIC_VIOLATION", `Kan ikke gå fra ${prevStatus} til ${wanted}.`);
    }

    // DELIVERED er endelig (selv om samme status settes igjen er ok / idempotent)
    if (prevStatus === "DELIVERED" && wanted !== "DELIVERED") {
      return jsonErr(409, rid, "MONOTONIC_VIOLATION", "DELIVERED er endelig. Kan ikke endres.");
    }

    const ts = nowIso();

    // Bevar eksisterende tidsstempler
    let packed_at: string | null = existing?.packed_at ?? null;
    let delivered_at: string | null = existing?.delivered_at ?? null;

    // ✅ Smart + monotont:
    // - PACKED: sett packed_at hvis mangler (ikke null noe)
    // - DELIVERED: sett packed_at hvis mangler, sett delivered_at hvis mangler
    if (wanted === "PACKED") {
      if (!packed_at) packed_at = ts;
      // delivered_at beholdes hvis den allerede finnes (idempotent)
    } else if (wanted === "DELIVERED") {
      if (!packed_at) packed_at = ts;
      if (!delivered_at) delivered_at = ts;
    }

    const payload = {
      delivery_date: date,
      delivery_window: slot,
      company_location_id: location_id,
      status: wanted,
      packed_at,
      delivered_at,
    };

    // ✅ MUST audit (fail-closed) BEFORE write
    await auditWriteMust({
      rid,
      action: "kitchen_batch_set_status",
      entity_type: "order_batch",
      entity_id: entityKey(date, slot, location_id),
      company_id: null,
      location_id,
      actor_user_id: safeStr(scope?.userId) || auth.user.id,
      actor_email: scope?.email ?? null,
      actor_role: scope?.role ?? null,
      summary: `Batch set ${wanted}`,
      detail: {
        route: "/api/kitchen/batch/set",
        input: { date, slot, location_id, status: wanted },
        before: existing
          ? {
              status: safeStr(existing.status).toUpperCase() || null,
              packed_at: existing.packed_at ?? null,
              delivered_at: existing.delivered_at ?? null,
            }
          : null,
      },
    });

    // ✅ Upsert (unique constraint)
    const { data: saved, error: upErr } = await admin
      .from("kitchen_batch")
      .upsert(payload, { onConflict: "delivery_date,delivery_window,company_location_id" })
      .select("delivery_date,delivery_window,company_location_id,status,packed_at,delivered_at")
      .maybeSingle<KitchenBatchRow>();

    if (upErr || !saved) {
      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke lagre batch.", {
        message: upErr?.message ?? null,
        code: (upErr as any)?.code ?? null,
      });
    }

    const outStatus = safeStr(saved.status).toUpperCase() as BatchStatus;

    // ✅ Testen forventer json.status (top-level)
    return NextResponse.json(
      {
        ok: true,
        rid,
        status: outStatus,
        batch: {
          delivery_date: saved.delivery_date,
          delivery_window: saved.delivery_window,
          company_location_id: saved.company_location_id,
          status: outStatus,
          packed_at: saved.packed_at ?? null,
          delivered_at: saved.delivered_at ?? null,
        },
      },
      { status: 200, headers: noStoreHeaders() }
    );
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", safeStr(e?.message ?? e), { at: "kitchen/batch/set" });
  }
}
