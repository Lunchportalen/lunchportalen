// app/api/kitchen/orders/batch-status/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { cutoffStatusForDate0805, osloNowISO } from "@/lib/date/oslo";
import { sendOrderBackup } from "@/lib/orders/orderBackup";
import { loadProfileByUserId } from "@/lib/db/profileLookup";

type OrderStatus = "QUEUED" | "PACKED" | "DELIVERED";
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

function normStatus(v: unknown): OrderStatus | null {
  const s = asString(v).toUpperCase();
  if (s === "QUEUED" || s === "PACKED" || s === "DELIVERED") return s;
  return null;
}

function rankStatus(s: string | null | undefined) {
  const v = asString(s).toUpperCase();
  if (v === "DELIVERED") return 2;
  if (v === "PACKED") return 1;
  if (v === "QUEUED" || v === "ACTIVE") return 0;
  return -1;
}

function cutoffAllowed(dateISO: string) {
  const status = cutoffStatusForDate0805(dateISO);
  if (status === "TODAY_LOCKED") return { ok: true as const };
  if (status === "PAST") return { ok: false as const, code: "DATE_LOCKED_PAST", message: "Datoen er passert og kan ikke endres." };
  return { ok: false as const, code: "LOCKED_AFTER_0805", message: "Statusendring er kun tillatt etter kl. 08:05 i dag." };
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
  const role = asString(scope?.role).toLowerCase();
  const today = osloNowISO().slice(0, 10);
  if (role === "kitchen" && q.date && q.date !== today) {
    return jsonErr(rid, "Kjøkken kan kun se dagens ordre.", 403, { code: "FORBIDDEN_DATE", detail: { date: q.date, today } });
  }

  // Valider query
  if (q.date && !isISODate(q.date)) {
    return jsonErr(rid, "Ugyldig datoformat. Bruk YYYY-MM-DD.", 400, { code: "BAD_REQUEST", detail: { date: q.date } });
  }
  if (q.locationId && !isUuid(q.locationId)) {
    return jsonErr(rid, "Ugyldig locationId.", 400, { code: "BAD_REQUEST", detail: { locationId: q.locationId } });
  }

  const rawIds = uniq(q.orderIds).filter(isUuid);
  const hasIds = rawIds.length > 0;
  const hasFilter = !!(q.date || q.slot || q.companyId || q.locationId);

  if (!hasIds && !hasFilter) {
    return jsonErr(rid, "Mangler input. Send enten query orderId=... (flere) eller filter (date/slot/companyId/locationId).", 400, { code: "BAD_REQUEST", detail: { q } });
  }

  const admin = supabaseAdmin();

  const userId = asString(scope?.userId);
  if (!userId) return jsonErr(rid, "Mangler bruker.", 403, "FORBIDDEN");

  const { data: prof, error: profErr } = await loadProfileByUserId(
    admin as any,
    userId,
    "company_id, location_id, disabled_at, is_active"
  );

  if (profErr || !prof) return jsonErr(rid, "Mangler profil.", 403, "FORBIDDEN");
  if ((prof as any).disabled_at || (prof as any).is_active === false) {
    return jsonErr(rid, "Bruker er deaktivert.", 403, "FORBIDDEN");
  }

  const companyId = asString((prof as any).company_id);
  const locationId = asString((prof as any).location_id);
  if (!companyId) return jsonErr(rid, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");

  if (q.companyId && q.companyId !== companyId) {
    return jsonErr(rid, "Ugyldig firmatilknytning.", 403, "FORBIDDEN");
  }
  if (locationId && q.locationId && q.locationId !== locationId) {
    return jsonErr(rid, "Ugyldig lokasjon.", 403, "FORBIDDEN");
  }

  let ids: string[] = [];
  if (hasIds) {
    let sel = admin.from("orders").select("id").in("id", rawIds).eq("company_id", companyId);
    if (role === "kitchen") sel = sel.eq("date", today);
    if (locationId) sel = sel.eq("location_id", locationId);
    const { data, error } = await sel;
    if (error) {
      return jsonErr(rid, "Kunne ikke hente ordre for dry-run.", 500, { code: "DB_ERROR", detail: {
        code: error.code,
        message: error.message,
        detail: (error as any).details ?? (error as any).hint ?? null,
      } });
    }
    ids = uniq((data ?? []).map((r: any) => String(r.id))).filter(isUuid);
  } else {
    let sel = admin.from("orders").select("id");
    if (q.date) sel = sel.eq("date", q.date);
    if (!q.date && role === "kitchen") sel = sel.eq("date", today);
    if (q.slot) sel = sel.eq("slot", q.slot);
    sel = sel.eq("company_id", companyId);
    if (locationId) sel = sel.eq("location_id", locationId);

    const { data, error } = await sel;
    if (error) {
      return jsonErr(rid, "Kunne ikke hente ordre for dry-run.", 500, { code: "DB_ERROR", detail: {
        code: error.code,
        message: error.message,
        detail: (error as any).details ?? (error as any).hint ?? null,
      } });
    }

    ids = uniq((data ?? []).map((r: any) => String(r.id))).filter(isUuid);
  }

  const MAX_RETURN = 200;
  return jsonOk(rid, {
      matched: ids.length,
      idsPreview: ids.slice(0, MAX_RETURN),
      truncated: ids.length > MAX_RETURN,
      mode: hasIds ? "ids" : "filter",
      q,
    }, 200);
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

  const admin = supabaseAdmin();
  const userId = asString(scope?.userId);
  if (!userId) return jsonErr(rid, "Mangler bruker.", 403, "FORBIDDEN");

  const { data: prof, error: profErr } = await loadProfileByUserId(
    admin as any,
    userId,
    "company_id, location_id, disabled_at, is_active"
  );

  if (profErr || !prof) return jsonErr(rid, "Mangler profil.", 403, "FORBIDDEN");
  if ((prof as any).disabled_at || (prof as any).is_active === false) {
    return jsonErr(rid, "Bruker er deaktivert.", 403, "FORBIDDEN");
  }

  const companyIdScope = asString((prof as any).company_id);
  const locationIdScope = asString((prof as any).location_id);
  if (!companyIdScope) return jsonErr(rid, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");

  const body = ((await readJson(req)) ?? {}) as Body;

  const statusInput = normStatus(body.status);
  if (!statusInput) {
    return jsonErr(rid, "Ugyldig status.", 400, { code: "BAD_REQUEST", detail: { status: body.status } });
  }
  if (statusInput !== "PACKED") {
    return jsonErr(rid, "Kjøkken kan kun sette status PACKED.", 403, "FORBIDDEN_STATUS");
  }
  const status: OrderStatus = "PACKED";

  const note = null;

  // Variant A: orderIds
  const rawIds = Array.isArray(body.orderIds) ? body.orderIds.map(asString).filter(Boolean) : [];
  const orderIds = uniq(rawIds).filter(isUuid);

  // Variant B: filter-batch
  const todayPost = osloNowISO().slice(0, 10);
  const date = asString(body.date) || (asString(scope?.role).toLowerCase() === "kitchen" ? todayPost : "");
  const slot = asString(body.slot);
  const companyId = asString(body.companyId);
  const locationId = asString(body.locationId);

  if (companyId && companyId !== companyIdScope) {
    return jsonErr(rid, "Ugyldig firmatilknytning.", 403, "FORBIDDEN");
  }
  if (locationIdScope && locationId && locationId !== locationIdScope) {
    return jsonErr(rid, "Ugyldig lokasjon.", 403, "FORBIDDEN");
  }

  const hasFilterBatch = !orderIds.length && (date || slot || companyId || locationId);

  if (!orderIds.length && !hasFilterBatch) {
    return jsonErr(rid, "Mangler input. Send enten { orderIds: [...] } eller filter (date/slot/companyId/locationId).", 400, { code: "BAD_REQUEST", detail: { orderIdsCount: orderIds.length, date, slot, companyId, locationId } });
  }

  if (hasFilterBatch && date && !isISODate(date)) {
    return jsonErr(rid, "Ugyldig datoformat. Bruk YYYY-MM-DD.", 400, { code: "BAD_REQUEST", detail: { date } });
  }
  if (asString(scope?.role).toLowerCase() === "kitchen" && date !== todayPost) {
    return jsonErr(rid, "Kjøkken kan kun oppdatere dagens ordre.", 403, { code: "FORBIDDEN_DATE", detail: { date, today: todayPost } });
  }
  if (companyId && !isUuid(companyId)) {
    return jsonErr(rid, "Ugyldig companyId.", 400, { code: "BAD_REQUEST", detail: { companyId } });
  }
  if (locationId && !isUuid(locationId)) {
    return jsonErr(rid, "Ugyldig locationId.", 400, { code: "BAD_REQUEST", detail: { locationId } });
  }

  let idsToUpdate: string[] = orderIds;

  if (hasFilterBatch) {
    if (!date) {
      return jsonErr(rid, "Dato er påkrevd for batch-status.", 400, { code: "BAD_REQUEST", detail: { date } });
    }
    const cutoff = cutoffAllowed(date);
    if (!cutoff.ok) {
      return jsonErr(rid, cutoff.message, 423, { code: cutoff.code, detail: { date, cutoff: "08:05" } });
    }

    let q = admin.from("orders").select("id");
    if (date) q = q.eq("date", date);
    if (slot) q = q.eq("slot", slot);
    q = q.eq("company_id", companyIdScope);
    if (locationIdScope) q = q.eq("location_id", locationIdScope);

    const { data: rows, error } = await q;
    if (error) {
      return jsonErr(rid, "Kunne ikke hente ordre for batch-oppdatering.", 500, { code: "DB_ERROR", detail: {
        code: error.code,
        message: error.message,
        detail: (error as any).details ?? (error as any).hint ?? null,
      } });
    }

    idsToUpdate = uniq((rows ?? []).map((r: any) => String(r.id))).filter(isUuid);
    if (!idsToUpdate.length) {
      return jsonOk(rid, { updated: 0, matched: 0, status, note, mode: "filter" }, 200);
    }
  }

  // Safety limit
  const MAX = 2000;
  if (idsToUpdate.length > MAX) {
    return jsonErr(rid, `For mange ordre i én batch. Maks ${MAX}.`, 400, { code: "BAD_REQUEST", detail: { count: idsToUpdate.length } });
  }

  // Load current rows (for cutoff + monotonic + backup)
  const { data: rows, error: rowErr } = await admin
    .from("orders")
    .select("id,date,status,company_id,location_id,slot,user_id")
    .in("id", idsToUpdate)
    .eq("company_id", companyIdScope);

  if (rowErr) {
    return jsonErr(rid, "Kunne ikke lese ordre for status-oppdatering.", 500, { code: "DB_ERROR", detail: {
      code: rowErr.code,
      message: rowErr.message,
    } });
  }

  let orderRows = (rows ?? []) as Array<{
    id: string;
    date: string | null;
    status: string | null;
    company_id: string | null;
    location_id: string | null;
    slot: string | null;
    user_id: string | null;
  }>;

  if (locationIdScope) {
    orderRows = orderRows.filter((r) => asString(r.location_id) === locationIdScope);
  }

  if (orderIds.length && orderRows.length !== idsToUpdate.length) {
    return jsonErr(rid, "En eller flere ordre tilhører ikke firmaet.", 403, "FORBIDDEN");
  }

  if (!orderRows.length) {
    return jsonOk(rid, { updated: 0, matched: 0, status, mode: hasFilterBatch ? "filter" : "ids" }, 200);
  }

  for (const row of orderRows) {
    const rowDate = asString(row.date);
    if (!rowDate || !isISODate(rowDate)) {
      return jsonErr(rid, "Ordre har ugyldig dato.", 409, { code: "INVALID_DATE", detail: { orderId: row.id, date: row.date } });
    }

    const cutoff = cutoffAllowed(rowDate);
    if (!cutoff.ok) {
      return jsonErr(rid, cutoff.message, 423, { code: cutoff.code, detail: { date: rowDate, cutoff: "08:05" } });
    }

    const currentRank = rankStatus(row.status);
    if (currentRank < 0) {
      return jsonErr(rid, "Ordre har ugyldig status for produksjon.", 409, { code: "INVALID_STATUS", detail: { orderId: row.id, status: row.status } });
    }
    const desiredRank = rankStatus(status);
    if (desiredRank < currentRank) {
      return jsonErr(rid, "Kan ikke nedgradere status.", 409, { code: "MONOTONIC_VIOLATION", detail: {
        orderId: row.id,
        current: row.status,
        desired: status,
      } });
    }
  }

  const idsToUpdateFiltered = orderRows
    .filter((r) => {
      const currentRank = rankStatus(r.status);
      const desiredRank = rankStatus(status);
      return currentRank < desiredRank;
    })
    .map((r) => r.id);
  if (!idsToUpdateFiltered.length) {
    return jsonOk(rid, { updated: 0, matched: orderRows.length, status, mode: hasFilterBatch ? "filter" : "ids" }, 200);
  }

  // Update orders
  const nowIso = new Date().toISOString();
  const { data: updatedRows, error: updErr } = await admin
    .from("orders")
    .update({ status, updated_at: nowIso })
    .in("id", idsToUpdateFiltered)
    .select("id,status,updated_at");

  if (updErr) {
    return jsonErr(rid, "Batch status-oppdatering feilet.", 500, { code: "DB_ERROR", detail: {
      code: updErr.code,
      message: updErr.message,
      detail: (updErr as any).details ?? (updErr as any).hint ?? null,
    } });
  }

  const updated = (updatedRows ?? []).length;

  // Audit (batch)
  const detail = {
    mode: orderIds.length ? "ids" : "filter",
    status,
    note,
    count: idsToUpdateFiltered.length,
    updated,
    date: date || null,
    slot: slot || null,
    companyId: companyIdScope,
    locationId: locationIdScope || null,
    orderIds: idsToUpdateFiltered,
  };

  const { error: auditErr } = await admin.from("audit_events").insert({
    rid,
    action: "orders.batch_status",

    entity_type: "order",
    entity_id: idsToUpdate[0],

    actor_user_id: scope.userId ?? null,
    actor_email: scope.email ?? null,
    actor_role: scope.role ?? null,

    company_id: companyIdScope,
    location_id: locationIdScope || null,

    summary: `Batch status → ${status} (${idsToUpdate.length} ordre)`,
    detail,
  });

  if (auditErr) {
    return jsonOk(rid, {
        updated,
        matched: idsToUpdate.length,
        status,
        warning: "Batch oppdatert, men audit-logging feilet.",
        audit: { code: auditErr.code, message: auditErr.message },
      }, 200);
  }

  const backupTs = osloNowISO();
  try {
    const companyIds = uniq(orderRows.map((r) => asString(r.company_id)).filter(Boolean));
    const locationIds = uniq(orderRows.map((r) => asString(r.location_id)).filter(Boolean));

    const [cRes, lRes] = await Promise.all([
      companyIds.length ? admin.from("companies").select("id,name").in("id", companyIds) : Promise.resolve({ data: [], error: null } as any),
      locationIds.length ? admin.from("company_locations").select("id,name,label").in("id", locationIds) : Promise.resolve({ data: [], error: null } as any),
    ]);

    const companyMap = new Map<string, string>();
    const locationMap = new Map<string, string>();
    (cRes.data ?? []).forEach((c: any) => companyMap.set(String(c.id), asString(c.name)));
    (lRes.data ?? []).forEach((l: any) => locationMap.set(String(l.id), asString(l.name) || asString(l.label)));

    const updatedSet = new Set(idsToUpdateFiltered);
    for (const row of orderRows) {
      if (!updatedSet.has(row.id)) continue;
      const cid = asString(row.company_id);
      const lid = asString(row.location_id);
      if (!cid || !lid) continue;

      await sendOrderBackup({
        rid,
        action: "STATUS",
        status,
        orderId: row.id,
        date: asString(row.date),
        slot: row.slot ?? null,
        user_id: asString(row.user_id),
        company_id: cid,
        location_id: lid,
        company_name: companyMap.get(cid) || null,
        location_name: locationMap.get(lid) || null,
        actor_email: scope.email ?? null,
        actor_role: scope.role ?? null,
        note: note ?? null,
        timestamp_oslo: backupTs,
        extra: { route: "/api/kitchen/orders/batch-status" },
      });
    }
  } catch {
    // best effort
  }

  return jsonOk(rid, { updated, matched: idsToUpdateFiltered.length, status }, 200);
}
