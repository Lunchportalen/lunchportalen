// app/api/driver/bulk-set/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { osloTodayISODate } from "@/lib/date/oslo";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { loadProfileByUserId } from "@/lib/db/profileLookup";
import { auditWriteMust } from "@/lib/audit/auditWrite";
import { batchTransitionAndSyncOrders } from "@/lib/kitchen/batchTransitionRpc";
import { normOperativeSlot } from "@/lib/kitchen/operativeSlot";
import { loadOperativeKitchenOrders, normKitchenSlot } from "@/lib/server/kitchen/loadOperativeKitchenOrders";
import { fetchProductionOperativeSnapshotAllowlist } from "@/lib/server/kitchen/fetchProductionOperativeSnapshotAllowlist";

type BatchStatus = "queued" | "packed" | "delivered";

function rid() {
  return crypto.randomUUID();
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function isIsoDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}
function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
  );
}
function asStatus(v: any): BatchStatus | null {
  const s = safeStr(v).toLowerCase();
  if (s === "queued" || s === "packed" || s === "delivered") return s as BatchStatus;
  return null;
}

async function readJson(req: NextRequest) {
  const t = await req.text();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return {};
  }
}

/**
 * Driver bulk-set:
 * - Oppdaterer "kitchen_batches" for en gitt dato + leveringsvindu (slot) og en liste med locationIds
 * - Brukes av Driver-view til å markere: queued → packed → delivered
 *
 * Forventet body:
 * {
 *   "date": "YYYY-MM-DD" (optional, default osloTodayISODate()),
 *   "slot": "HH:MM-HH:MM" | "AM" | "Lunch" | ... (required),
 *   "status": "queued"|"packed"|"delivered" (required),
 *   "locationIds": ["uuid", ...] (required, 1+)
 * }
 */
export async function POST(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const r = rid();

  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;

  const roleDeny = requireRoleOr403(gate.ctx, ["driver", "superadmin"]);
  if (roleDeny) return roleDeny;

  const userId = safeStr(gate.ctx?.scope?.userId);
  if (!userId) return jsonErr(safeStr(gate.ctx?.rid) || r, "Mangler bruker.", 403, "FORBIDDEN");

  const admin = supabaseAdmin();

  const { data: profile, error: pErr } = await loadProfileByUserId(
    admin as any,
    userId,
    "disabled_at,company_id,location_id"
  );

  if (pErr || !profile) {
    return jsonErr(safeStr(gate.ctx?.rid) || r, "Mangler tilgang (profile).", 403, "FORBIDDEN");
  }
  if (profile.disabled_at) {
    return jsonErr(safeStr(gate.ctx?.rid) || r, "Bruker er deaktivert.", 403, "FORBIDDEN");
  }

  const companyId = safeStr((profile as any).company_id);
  const locationId = safeStr((profile as any).location_id);
  if (!companyId) return jsonErr(safeStr(gate.ctx?.rid) || r, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");

  // ---- input ----
  const body = await readJson(req);

  const dateRaw = safeStr(body?.date);
  const today = osloTodayISODate();
  if (dateRaw && isIsoDate(dateRaw) && dateRaw !== today) {
    return jsonErr(safeStr(gate.ctx?.rid) || r, "Sjåfør kan kun oppdatere dagens leveranser.", 403, { code: "FORBIDDEN_DATE", detail: { date: dateRaw, today } });
  }
  const date = today;

  const slot = safeStr(body?.slot);
  const statusRaw = asStatus(body?.status);

  const locsIn = Array.isArray(body?.locationIds) ? body.locationIds : [];
  const locationIds: string[] = Array.from(
    new Set<string>(locsIn.map((x: any) => safeStr(x)).filter((x): x is string => isUuid(x)))
  );

  if (!slot) return jsonErr(safeStr(gate.ctx?.rid) || r, "Mangler slot.", 400, "VALIDATION");
  if (!statusRaw) return jsonErr(safeStr(gate.ctx?.rid) || r, "Ugyldig status. Bruk delivered.", 400, "VALIDATION");
  if (statusRaw !== "delivered") {
    return jsonErr(safeStr(gate.ctx?.rid) || r, "Sjåfør kan kun sette status DELIVERED.", 403, "FORBIDDEN_STATUS");
  }
  const status = "delivered" as const;
  if (locationIds.length === 0) return jsonErr(safeStr(gate.ctx?.rid) || r, "Mangler locationIds (uuid).", 400, "VALIDATION");

  const { data: locs, error: locErr } = await admin
    .from("company_locations")
    .select("id, company_id")
    .eq("company_id", companyId)
    .in("id", locationIds);

  if (locErr) {
    return jsonErr(safeStr(gate.ctx?.rid) || r, "Kunne ikke validere lokasjoner.", 500, { code: "DB_ERROR", detail: { message: locErr.message } });
  }

  const allowed = new Set((locs ?? []).map((l: any) => String(l.id)));
  const allowedIds = locationIds.filter((id) => allowed.has(id));

  if (allowedIds.length !== locationIds.length) {
    return jsonErr(safeStr(gate.ctx?.rid) || r, "En eller flere lokasjoner er ugyldige for firma.", 403, "FORBIDDEN");
  }
  if (locationId && !allowedIds.includes(locationId)) {
    return jsonErr(safeStr(gate.ctx?.rid) || r, "Ugyldig lokasjon.", 403, "FORBIDDEN");
  }

  if (allowedIds.length === 0) {
    return jsonErr(safeStr(gate.ctx?.rid) || r, "Ingen lokasjoner er gyldige for firma.", 403, "FORBIDDEN");
  }

  const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: date, companyId });
  const productionFreezeAllowlist = snap.found ? snap.orderIds : undefined;

  const loaded = await loadOperativeKitchenOrders({
    admin: admin as any,
    dateISO: date,
    tenant: { companyId, locationId: locationId || null },
    productionFreezeAllowlist,
  });
  if (loaded.ok === false) {
    return jsonErr(safeStr(gate.ctx?.rid) || r, "Kunne ikke validere dagens stops.", 500, { code: "DB_ERROR", detail: { message: loaded.dbError.message } });
  }

  const slotNorm = normKitchenSlot(slot);
  const slotCanonical = normOperativeSlot(slot);
  const allowedByStops = new Set(
    loaded.operative.filter((o) => normKitchenSlot(o.slot) === slotNorm).map((o) => String(o.location_id))
  );
  const finalIds = allowedIds.filter((id) => allowedByStops.has(id));

  if (finalIds.length !== allowedIds.length) {
    return jsonErr(safeStr(gate.ctx?.rid) || r, "En eller flere lokasjoner er ikke en del av dagens stops.", 403, { code: "FORBIDDEN", detail: { date, slot } });
  }
  if (finalIds.length === 0) {
    return jsonErr(safeStr(gate.ctx?.rid) || r, "Ingen stops funnet for dagens leveranser.", 403, { code: "FORBIDDEN", detail: { date, slot } });
  }

  // ---- write (batch DELIVERED + derived orders.status in one RPC per location) ----
  const now = new Date().toISOString();
  const updatedRows: Array<Record<string, unknown>> = [];

  for (const locId of finalIds) {
    await auditWriteMust({
      rid: safeStr(gate.ctx?.rid) || r,
      action: "driver_bulk_set_delivered",
      entity_type: "kitchen_batch",
      entity_id: `${date}__${slotCanonical}__${locId}`,
      company_id: companyId,
      location_id: locId,
      actor_user_id: userId,
      actor_email: gate.ctx?.scope?.email ?? null,
      actor_role: gate.ctx?.scope?.role ?? null,
      summary: "Driver bulk-set DELIVERED",
      detail: { date, slot: slotCanonical, location_id: locId },
    });

    const transitioned = await batchTransitionAndSyncOrders(admin as any, {
      deliveryDate: date,
      deliveryWindow: slotCanonical,
      companyLocationId: locId,
      targetBatchStatus: "DELIVERED",
      actorUserId: userId,
      mode: "from_packed",
    });

    if (transitioned.error || !transitioned.data) {
      const msg = transitioned.error?.message ?? "Kunne ikke oppdatere batch-status.";
      if (msg.includes("PERMISSION_DENIED")) {
        return jsonErr(safeStr(gate.ctx?.rid) || r, "Mangler sjåfør-tilgang hos leverandør.", 403, "FORBIDDEN");
      }
      if (msg.includes("BATCH_NOT_FOUND")) {
        return jsonErr(safeStr(gate.ctx?.rid) || r, "Batch finnes ikke for stop.", 404, { code: "NOT_FOUND", detail: { date, slot: slotCanonical, location_id: locId } });
      }
      if (msg.includes("INVALID_BATCH_TRANSITION")) {
        return jsonErr(safeStr(gate.ctx?.rid) || r, "Batch er ikke klar for levering.", 409, { code: "INVALID_BATCH_STATE", detail: { date, slot: slotCanonical, location_id: locId } });
      }
      return jsonErr(safeStr(gate.ctx?.rid) || r, "Kunne ikke oppdatere batch-status.", 500, { code: "BATCH_TRANSITION_FAILED", detail: { message: msg } });
    }

    if (transitioned.data.batch_updated) {
      updatedRows.push({
        delivery_date: transitioned.data.batch.delivery_date,
        delivery_window: transitioned.data.batch.delivery_window,
        company_location_id: transitioned.data.batch.company_location_id,
        status: transitioned.data.batch.status,
        packed_at: transitioned.data.batch.packed_at,
        delivered_at: transitioned.data.batch.delivered_at ?? now,
        sync: transitioned.data.sync,
      });
    } else {
      updatedRows.push({
        delivery_date: date,
        delivery_window: slotCanonical,
        company_location_id: locId,
        status: "DELIVERED",
        packed_at: transitioned.data.batch.packed_at,
        delivered_at: transitioned.data.batch.delivered_at,
        sync: transitioned.data.sync,
      });
    }
  }

  return jsonOk(safeStr(gate.ctx?.rid) || r, { date, slot: slotCanonical, status, updated: updatedRows.length, rows: updatedRows }, 200);
}
