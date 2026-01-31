// app/api/kitchen/orders/batch-status/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";

type OrderStatus = "active" | "canceled" | "delivered";
const allowedRoles = ["kitchen", "superadmin"] as const;

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}
function asString(v: unknown) {
  return String(v ?? "").trim();
}
function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}
function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

type Body = {
  // Variant A: presis batch
  orderIds?: string[];

  // Variant B: filter-batch (hvis orderIds ikke er sendt)
  date?: string; // YYYY-MM-DD
  slot?: string;
  companyId?: string;
  locationId?: string;

  // Felles
  status: OrderStatus;
  note?: string | null;
};

function parseQuery(req: NextRequest) {
  const u = new URL(req.url);
  const date = asString(u.searchParams.get("date"));
  const slot = asString(u.searchParams.get("slot"));
  const companyId = asString(u.searchParams.get("companyId"));
  const locationId = asString(u.searchParams.get("locationId"));

  const orderIds = u.searchParams
    .getAll("orderId")
    .map((x) => asString(x))
    .filter(Boolean);

  return { date, slot, companyId, locationId, orderIds };
}

/**
 * GET = DRY-RUN
 * - Returnerer hvor mange ordre som matcher (og ev. id-liste innenfor en cap)
 */
export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s = await scopeOr401(req);
  if (s.ok === false) return s.res;

  const ctx = s.ctx;
  const { rid, scope } = ctx;

  // ✅ riktig signatur: (ctx|rid, role, allowed)
  const roleBlock = requireRoleOr403(ctx, scope.role ?? null, allowedRoles);
  if (roleBlock) return roleBlock;

  const q = parseQuery(req);

  // Valider query
  if (q.date && !isISODate(q.date)) {
    return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig datoformat. Bruk YYYY-MM-DD.", { date: q.date });
  }
  if (q.companyId && !isUuid(q.companyId)) {
    return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig companyId.", { companyId: q.companyId });
  }
  if (q.locationId && !isUuid(q.locationId)) {
    return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig locationId.", { locationId: q.locationId });
  }

  const rawIds = uniq(q.orderIds).filter(isUuid);
  const hasIds = rawIds.length > 0;
  const hasFilter = !!(q.date || q.slot || q.companyId || q.locationId);

  if (!hasIds && !hasFilter) {
    return jsonErr(
      400,
      rid,
      "BAD_REQUEST",
      "Mangler input. Send enten query orderId=... (flere) eller filter (date/slot/companyId/locationId).",
      { q }
    );
  }

  const admin = supabaseAdmin();

  let ids: string[] = [];
  if (hasIds) {
    ids = rawIds;
  } else {
    let sel = admin.from("orders").select("id");
    if (q.date) sel = sel.eq("date", q.date);
    if (q.slot) sel = sel.eq("slot", q.slot);
    if (q.companyId) sel = sel.eq("company_id", q.companyId);
    if (q.locationId) sel = sel.eq("location_id", q.locationId);

    const { data, error } = await sel;
    if (error) {
      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente ordre for dry-run.", {
        code: error.code,
        message: error.message,
        detail: (error as any).details ?? (error as any).hint ?? null,
      });
    }

    ids = uniq((data ?? []).map((r: any) => String(r.id))).filter(isUuid);
  }

  const MAX_RETURN = 200;
  return jsonOk(
    {
      ok: true,
      rid,
      matched: ids.length,
      idsPreview: ids.slice(0, MAX_RETURN),
      truncated: ids.length > MAX_RETURN,
      mode: hasIds ? "ids" : "filter",
      q,
    },
    200
  );
}

/**
 * POST = APPLY
 * - Oppdaterer status på mange ordre samtidig
 * - Logger 1 audit-rad (batch)
 */
export async function POST(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s = await scopeOr401(req);
  if (s.ok === false) return s.res;

  const ctx = s.ctx;
  const { rid, scope } = ctx;

  const roleBlock = requireRoleOr403(ctx, scope.role ?? null, allowedRoles);
  if (roleBlock) return roleBlock;

  const body = ((await readJson(req)) ?? {}) as Body;

  const status = asString(body.status) as OrderStatus;
  if (!["active", "canceled", "delivered"].includes(status)) {
    return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig status.", { status });
  }

  const note = body.note == null ? null : asString(body.note).slice(0, 500);

  // Variant A: orderIds
  const rawIds = Array.isArray(body.orderIds) ? body.orderIds.map(asString).filter(Boolean) : [];
  const orderIds = uniq(rawIds).filter(isUuid);

  // Variant B: filter-batch
  const date = asString(body.date);
  const slot = asString(body.slot);
  const companyId = asString(body.companyId);
  const locationId = asString(body.locationId);

  const hasFilterBatch = !orderIds.length && (date || slot || companyId || locationId);

  if (!orderIds.length && !hasFilterBatch) {
    return jsonErr(
      400,
      rid,
      "BAD_REQUEST",
      "Mangler input. Send enten { orderIds: [...] } eller filter (date/slot/companyId/locationId).",
      { orderIdsCount: orderIds.length, date, slot, companyId, locationId }
    );
  }

  if (hasFilterBatch && date && !isISODate(date)) {
    return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig datoformat. Bruk YYYY-MM-DD.", { date });
  }
  if (companyId && !isUuid(companyId)) {
    return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig companyId.", { companyId });
  }
  if (locationId && !isUuid(locationId)) {
    return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig locationId.", { locationId });
  }

  const admin = supabaseAdmin();
  let idsToUpdate: string[] = orderIds;

  if (hasFilterBatch) {
    let q = admin.from("orders").select("id");
    if (date) q = q.eq("date", date);
    if (slot) q = q.eq("slot", slot);
    if (companyId) q = q.eq("company_id", companyId);
    if (locationId) q = q.eq("location_id", locationId);

    const { data: rows, error } = await q;
    if (error) {
      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente ordre for batch-oppdatering.", {
        code: error.code,
        message: error.message,
        detail: (error as any).details ?? (error as any).hint ?? null,
      });
    }

    idsToUpdate = uniq((rows ?? []).map((r: any) => String(r.id))).filter(isUuid);
    if (!idsToUpdate.length) {
      return jsonOk({ ok: true, rid, updated: 0, matched: 0, status, note, mode: "filter" }, 200);
    }
  }

  // Safety limit
  const MAX = 2000;
  if (idsToUpdate.length > MAX) {
    return jsonErr(400, rid, "BAD_REQUEST", `For mange ordre i én batch. Maks ${MAX}.`, { count: idsToUpdate.length });
  }

  // Update orders
  const nowIso = new Date().toISOString();
  const { data: updatedRows, error: updErr } = await admin
    .from("orders")
    .update({ status, updated_at: nowIso })
    .in("id", idsToUpdate)
    .select("id,status,updated_at");

  if (updErr) {
    return jsonErr(500, rid, "DB_ERROR", "Batch status-oppdatering feilet.", {
      code: updErr.code,
      message: updErr.message,
      detail: (updErr as any).details ?? (updErr as any).hint ?? null,
    });
  }

  const updated = (updatedRows ?? []).length;

  // Audit (batch)
  const detail = {
    mode: orderIds.length ? "ids" : "filter",
    status,
    note,
    count: idsToUpdate.length,
    updated,
    date: date || null,
    slot: slot || null,
    companyId: companyId || null,
    locationId: locationId || null,
    orderIds: idsToUpdate,
  };

  const { error: auditErr } = await admin.from("audit_events").insert({
    rid,
    action: "orders.batch_status",

    entity_type: "order",
    entity_id: idsToUpdate[0],

    actor_user_id: scope.userId ?? null,
    actor_email: scope.email ?? null,
    actor_role: scope.role ?? null,

    company_id: scope.companyId ?? null,
    location_id: scope.locationId ?? null,

    summary: `Batch status → ${status} (${idsToUpdate.length} ordre)`,
    detail,
  });

  if (auditErr) {
    return jsonOk(
      {
        ok: true,
        rid,
        updated,
        matched: idsToUpdate.length,
        status,
        warning: "Batch oppdatert, men audit-logging feilet.",
        audit: { code: auditErr.code, message: auditErr.message },
      },
      200
    );
  }

  return jsonOk({ ok: true, rid, updated, matched: idsToUpdate.length, status }, 200);
}


