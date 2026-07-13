// app/api/admin/locations/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

function safeInt(v: any, def: number, min: number, max: number) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function pick(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

function normStatus(row: any) {
  const raw = pick(row, ["status", "location_status", "state"]);
  if (raw) return String(raw).trim().toUpperCase();
  const isActive = row?.is_active ?? row?.active ?? row?.enabled;
  if (isActive === true) return "ACTIVE";
  if (isActive === false) return "INACTIVE";
  return null;
}

export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.locations.read", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  try {
    const url = new URL(req.url);
    const page = safeInt(url.searchParams.get("page"), 1, 1, 10_000);
    const limit = safeInt(url.searchParams.get("limit"), 50, 1, 200);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const admin = supabaseAdmin();

    const { data, error, count } = await admin
      .from("company_locations")
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return jsonErr(rid, "Kunne ikke hente lokasjoner.", 500, { code: "LOCATIONS_LIST_FAILED", detail: { message: error.message } });
    }

    const locations = (data ?? []).map((r: any) => ({
      id: String(r.id),
      company_id: r.company_id ? String(r.company_id) : null,

      name: pick(r, ["name", "title", "location_name"]) ?? null,

      contact_name: pick(r, ["contact_name", "contact", "delivery_contact", "leveringskontakt"]) ?? null,
      contact_phone: pick(r, ["contact_phone", "phone", "telephone", "contact_tlf", "leveringstelefon"]) ?? null,

      window_from: pick(r, ["window_from", "from", "time_from", "vindu_fra"]) ?? null,
      window_to: pick(r, ["window_to", "to", "time_to", "vindu_til"]) ?? null,

      notes: pick(r, ["notes", "note", "comment", "notater"]) ?? null,
      delivery_instructions: pick(r, ["delivery_instructions"]) ?? null,
      address: pick(r, ["address", "address_line1", "adresse"]) ?? null,
      slot_policy: pick(r, ["slot_policy", "slotpolicy"]) ?? null,
      status: normStatus(r),

      created_at: r.created_at ?? null,
      updated_at: r.updated_at ?? null,
    }));

    return jsonOk(rid, {
      companyId,
      page,
      limit,
      total: Number(count ?? 0),
      locations,
      _info: { selected: "* (schema-safe mapper)", note: "Fallback mapping to avoid missing columns." },
    });
  } catch (e: any) {
    return jsonErr(rid, String(e?.message ?? "Unknown error"), 500, { code: "UNHANDLED", detail: { at: "admin/locations" } });
  }
}

/** Fase 5: company_admin oppretter nytt leveringssted (med leveringsinstruksjoner). */
export async function POST(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;
  const denyRole = requireRoleOr403(a.ctx, "admin.locations.create", ["company_admin"]);
  if (denyRole) return denyRole;
  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const body = ((await readJson(req)) ?? {}) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  const address = String(body.address ?? "").trim();
  if (name.length < 2) return jsonErr(rid, "Navn på leveringssted må fylles ut.", 400, "NAME_REQUIRED");
  if (address.length < 4) return jsonErr(rid, "Adresse må fylles ut.", 400, "ADDRESS_REQUIRED");

  const hhmm = (v: unknown) => {
    const s = String(v ?? "").trim();
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null;
  };

  const row = {
    company_id: companyId,
    name,
    address,
    status: "ACTIVE",
    contact_name: String(body.contact_name ?? "").trim() || null,
    contact_phone: String(body.contact_phone ?? "").trim() || null,
    window_from: hhmm(body.window_from),
    window_to: hhmm(body.window_to),
    delivery_instructions: String(body.delivery_instructions ?? "").trim().slice(0, 2000) || null,
  };

  const admin = supabaseAdmin();
  const ins = await admin.from("company_locations").insert(row as any).select("id").maybeSingle();
  if (ins.error || !ins.data?.id) {
    return jsonErr(rid, "Kunne ikke opprette leveringssted.", 500, { code: "LOCATION_CREATE_FAILED", detail: { message: ins.error?.message } });
  }

  try {
    const { auditLog } = await import("@/lib/audit/log");
    auditLog({
      action: "COMPANY_LOCATION_CREATED",
      userId: String(scope.userId ?? "") || null,
      role: "company_admin",
      companyId,
      locationId: String(ins.data.id),
      resource: "company_location",
      resourceId: String(ins.data.id),
      metadata: { rid, name },
      timestamp: Date.now(),
      rid,
    });
  } catch {
    // audit best-effort
  }

  return jsonOk(rid, { location: { id: String(ins.data.id), ...row } }, 200);
}

/** Fase 5: company_admin oppdaterer leveringskontakt/-vindu/-instruksjoner. */
export async function PATCH(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;
  const denyRole = requireRoleOr403(a.ctx, "admin.locations.update", ["company_admin"]);
  if (denyRole) return denyRole;
  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const body = ((await readJson(req)) ?? {}) as Record<string, unknown>;
  const locationId = String(body.locationId ?? body.location_id ?? body.id ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(locationId)) return jsonErr(rid, "Ugyldig locationId.", 400, "BAD_REQUEST");

  const admin = supabaseAdmin();
  const existing = await admin.from("company_locations").select("id,company_id").eq("id", locationId).maybeSingle();
  if (existing.error) return jsonErr(rid, "Kunne ikke hente lokasjon.", 500, "DB_ERROR");
  if (!existing.data?.id) return jsonErr(rid, "Fant ikke lokasjon.", 404, "NOT_FOUND");
  if (String((existing.data as any).company_id ?? "") !== companyId) {
    return jsonErr(rid, "Ingen tilgang til lokasjon.", 403, "FORBIDDEN");
  }

  const hhmm = (v: unknown) => {
    const s = String(v ?? "").trim();
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null;
  };

  const patch: Record<string, unknown> = {};
  if ("name" in body) {
    const name = String(body.name ?? "").trim();
    if (name.length < 2) return jsonErr(rid, "Navn på leveringssted må fylles ut.", 400, "NAME_REQUIRED");
    patch.name = name;
  }
  if ("address" in body) {
    const address = String(body.address ?? "").trim();
    if (address.length < 4) return jsonErr(rid, "Adresse må fylles ut.", 400, "ADDRESS_REQUIRED");
    patch.address = address;
  }
  if ("contact_name" in body) patch.contact_name = String(body.contact_name ?? "").trim() || null;
  if ("contact_phone" in body) patch.contact_phone = String(body.contact_phone ?? "").trim() || null;
  if ("window_from" in body) patch.window_from = hhmm(body.window_from);
  if ("window_to" in body) patch.window_to = hhmm(body.window_to);
  if ("delivery_instructions" in body) {
    patch.delivery_instructions = String(body.delivery_instructions ?? "").trim().slice(0, 2000) || null;
  }
  if (Object.keys(patch).length === 0) return jsonErr(rid, "Ingen felter å oppdatere.", 400, "NO_FIELDS");
  patch.updated_at = new Date().toISOString();

  const upd = await admin.from("company_locations").update(patch as any).eq("id", locationId).select("id").maybeSingle();
  if (upd.error) return jsonErr(rid, "Kunne ikke oppdatere leveringssted.", 500, "LOCATION_UPDATE_FAILED");

  try {
    const { auditLog } = await import("@/lib/audit/log");
    auditLog({
      action: "COMPANY_LOCATION_UPDATED",
      userId: String(scope.userId ?? "") || null,
      role: "company_admin",
      companyId,
      locationId,
      resource: "company_location",
      resourceId: locationId,
      metadata: { rid, fields: Object.keys(patch) },
      timestamp: Date.now(),
      rid,
    });
  } catch {
    // audit best-effort
  }

  return jsonOk(rid, { location: { id: locationId, updated: Object.keys(patch) } }, 200);
}
