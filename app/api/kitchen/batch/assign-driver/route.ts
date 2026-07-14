// app/api/kitchen/batch/assign-driver/route.ts
//
// FASE 7 — sjåførtilordning på den kanoniske batch-modellen (kitchen_batches).
// Kun tilordning: ingen statusendring, ingen ny statusmaskin. Kjøkken/superadmin
// tildeler en sjåfør (profiles.role = driver i samme firma) til en batch
// (delivery_date, delivery_window, company_location_id). Full audit.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function isIsoDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export async function POST(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const g = await scopeOr401(req);
  if (g.ok === false) return g.res ?? g.response;

  const deny = requireRoleOr403(g.ctx, "kitchen.batch.assign_driver", ["kitchen", "superadmin"]);
  if (deny) return deny;
  const rid = g.ctx.rid;

  const body = ((await readJson(req)) ?? {}) as Record<string, unknown>;
  const date = safeStr(body.date ?? body.delivery_date);
  const window = safeStr(body.window ?? body.delivery_window) || "default";
  const locationId = safeStr(body.location_id ?? body.company_location_id);
  const driverUserId = safeStr(body.driver_user_id ?? body.driverUserId);

  if (!isIsoDate(date)) return jsonErr(rid, "Dato må være ÅÅÅÅ-MM-DD.", 400, "BAD_DATE");
  if (!isUuid(locationId)) return jsonErr(rid, "Ugyldig location_id.", 400, "BAD_LOCATION");
  if (!isUuid(driverUserId)) return jsonErr(rid, "Ugyldig driver_user_id.", 400, "BAD_DRIVER");

  const admin = supabaseAdmin();

  // Fail-closed: sjåføren må være en aktiv driver-profil. Kjøkken (firma-scope)
  // kan kun tildele sjåfører i eget firma; superadmin kan tildele på tvers.
  const { data: driver, error: driverErr } = await admin
    .from("profiles")
    .select("id, role, company_id, active")
    .eq("id", driverUserId)
    .maybeSingle();
  if (driverErr) return jsonErr(rid, "Kunne ikke verifisere sjåfør.", 500, "DRIVER_LOOKUP_FAILED");
  if (!driver || String((driver as any).role) !== "driver" || (driver as any).active === false) {
    return jsonErr(rid, "Brukeren er ikke en aktiv sjåfør.", 422, "NOT_A_DRIVER");
  }
  const scopeRole = safeStr(g.ctx.scope.role);
  const scopeCompanyId = safeStr(g.ctx.scope.companyId);
  if (scopeRole !== "superadmin") {
    if (!scopeCompanyId || safeStr((driver as any).company_id) !== scopeCompanyId) {
      return jsonErr(rid, "Sjåføren tilhører ikke ditt firma.", 403, "DRIVER_WRONG_COMPANY");
    }
    // Batch-lokasjonen må også tilhøre kjøkkenets firma (tenant isolation).
    const { data: loc } = await admin.from("company_locations").select("id, company_id").eq("id", locationId).maybeSingle();
    if (!loc || safeStr((loc as any).company_id) !== scopeCompanyId) {
      return jsonErr(rid, "Lokasjonen tilhører ikke ditt firma.", 403, "LOCATION_WRONG_COMPANY");
    }
  }

  // Tilordning endrer ALDRI batch-status: eksisterende batch → oppdater kun
  // tilordningsfeltene; ingen batch → opprett QUEUED med tilordning.
  const nowIso = new Date().toISOString();
  const assignment = {
    driver_user_id: driverUserId,
    driver_assigned_at: nowIso,
    driver_assigned_by: safeStr(g.ctx.scope.userId) || null,
    updated_at: nowIso,
  };

  const { data: existing, error: exErr } = await (admin as any)
    .from("kitchen_batches")
    .select("id, status")
    .eq("delivery_date", date)
    .eq("delivery_window", window)
    .eq("company_location_id", locationId)
    .maybeSingle();
  if (exErr) return jsonErr(rid, "Kunne ikke lese batch.", 500, "BATCH_READ_FAILED");

  let batchRow: { id: string; status: string; driver_user_id: string } | null = null;
  if (existing?.id) {
    const upd = await (admin as any)
      .from("kitchen_batches")
      .update(assignment)
      .eq("id", existing.id)
      .select("id, status, driver_user_id")
      .maybeSingle();
    if (upd.error || !upd.data) return jsonErr(rid, "Kunne ikke tildele sjåfør.", 500, "ASSIGN_FAILED");
    batchRow = upd.data;
  } else {
    const ins = await (admin as any)
      .from("kitchen_batches")
      .insert({
        delivery_date: date,
        delivery_window: window,
        company_location_id: locationId,
        status: "QUEUED",
        ...assignment,
      })
      .select("id, status, driver_user_id")
      .maybeSingle();
    if (ins.error || !ins.data) return jsonErr(rid, "Kunne ikke tildele sjåfør.", 500, "ASSIGN_FAILED");
    batchRow = ins.data;
  }

  try {
    const { auditLog } = await import("@/lib/audit/log");
    auditLog({
      action: "KITCHEN_BATCH_DRIVER_ASSIGNED",
      userId: safeStr(g.ctx.scope.userId) || null,
      role: scopeRole || null,
      companyId: scopeCompanyId || null,
      locationId,
      resource: "kitchen_batch",
      resourceId: safeStr(batchRow?.id) || null,
      metadata: { rid, date, window, driverUserId },
      timestamp: Date.now(),
      rid,
    });
  } catch {
    // audit best-effort
  }

  return jsonOk(rid, { batch: batchRow }, 200);
}
