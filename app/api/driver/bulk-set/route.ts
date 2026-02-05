// app/api/driver/bulk-set/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { osloTodayISODate } from "@/lib/date/oslo";
import { isSuperadminEmail } from "@/lib/system/emails";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { loadProfileByUserId } from "@/lib/db/profileLookup";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type ProfileRow = { role: Role | null; disabled_at: string | null; company_id?: string | null; location_id?: string | null };

type BatchStatus = "queued" | "packed" | "delivered";

function rid() {
  return crypto.randomUUID();
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function isHardSuperadmin(email: string | null | undefined) {
  return isSuperadminEmail(email);
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
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const r = rid();

  // ---- auth ----
  const sb = await supabaseServer();

  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    return jsonErr(r, "Ikke innlogget.", 401, "NOT_AUTHENTICATED");
  }

  // ---- role gate (driver/superadmin) ----
  const { data: profile, error: pErr } = await loadProfileByUserId(
    sb as any,
    user.id,
    "role,disabled_at,company_id,location_id"
  );

  if (pErr || !profile?.role) {
    return jsonErr(r, "Mangler tilgang (profile).", 403, "FORBIDDEN");
  }
  if (profile.disabled_at) {
    return jsonErr(r, "Bruker er deaktivert.", 403, "FORBIDDEN");
  }

  const role = String(profile.role ?? "").toLowerCase() as Role;
  const driverOk = role === "driver";
  const superOk = role === "superadmin" && isHardSuperadmin(user.email);

  if (!driverOk && !superOk) {
    return jsonErr(r, "Kun driver/superadmin har tilgang.", 403, "FORBIDDEN");
  }

  const companyId = safeStr((profile as any).company_id);
  const locationId = safeStr((profile as any).location_id);
  if (!companyId) return jsonErr(r, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");

  // ---- input ----
  const body = await readJson(req);

  const dateRaw = safeStr(body?.date);
  const today = osloTodayISODate();
  if (dateRaw && isIsoDate(dateRaw) && dateRaw !== today) {
    return jsonErr(r, "Sjåfør kan kun oppdatere dagens leveranser.", 403, { code: "FORBIDDEN_DATE", detail: { date: dateRaw, today } });
  }
  const date = today;

  const slot = safeStr(body?.slot);
  const statusRaw = asStatus(body?.status);

  const locsIn = Array.isArray(body?.locationIds) ? body.locationIds : [];
  const locationIds: string[] = Array.from(
    new Set<string>(locsIn.map((x: any) => safeStr(x)).filter((x): x is string => isUuid(x)))
  );

  if (!slot) return jsonErr(r, "Mangler slot.", 400, "VALIDATION");
  if (!statusRaw) return jsonErr(r, "Ugyldig status. Bruk delivered.", 400, "VALIDATION");
  if (statusRaw !== "delivered") {
    return jsonErr(r, "Sjåfør kan kun sette status DELIVERED.", 403, "FORBIDDEN_STATUS");
  }
  const status = "delivered" as const;
  if (locationIds.length === 0) return jsonErr(r, "Mangler locationIds (uuid).", 400, "VALIDATION");

  const admin = supabaseAdmin();
  const { data: locs, error: locErr } = await admin
    .from("company_locations")
    .select("id, company_id")
    .eq("company_id", companyId)
    .in("id", locationIds);

  if (locErr) {
    return jsonErr(r, "Kunne ikke validere lokasjoner.", 500, { code: "DB_ERROR", detail: { message: locErr.message } });
  }

  const allowed = new Set((locs ?? []).map((l: any) => String(l.id)));
  const allowedIds = locationIds.filter((id) => allowed.has(id));

  if (allowedIds.length !== locationIds.length) {
    return jsonErr(r, "En eller flere lokasjoner er ugyldige for firma.", 403, "FORBIDDEN");
  }
  if (locationId && !allowedIds.includes(locationId)) {
    return jsonErr(r, "Ugyldig lokasjon.", 403, "FORBIDDEN");
  }

  if (allowedIds.length === 0) {
    return jsonErr(r, "Ingen lokasjoner er gyldige for firma.", 403, "FORBIDDEN");
  }

  // 🔒 Stops-tilhørighet: lokasjoner må ha ordre i dag for gitt slot
  let ordersQ = admin
    .from("orders")
    .select("location_id")
    .eq("date", date)
    .eq("company_id", companyId)
    .eq("slot", slot)
    .in("status", ["ACTIVE", "active", "QUEUED", "PACKED", "DELIVERED"]);

  if (locationId) ordersQ = ordersQ.eq("location_id", locationId);

  const { data: ordRows, error: ordErr } = await ordersQ;
  if (ordErr) {
    return jsonErr(r, "Kunne ikke validere dagens stops.", 500, { code: "DB_ERROR", detail: { message: ordErr.message } });
  }

  const allowedByStops = new Set((ordRows ?? []).map((o: any) => String(o.location_id)));
  const finalIds = allowedIds.filter((id) => allowedByStops.has(id));

  if (finalIds.length !== allowedIds.length) {
    return jsonErr(r, "En eller flere lokasjoner er ikke en del av dagens stops.", 403, { code: "FORBIDDEN", detail: { date, slot } });
  }
  if (finalIds.length === 0) {
    return jsonErr(r, "Ingen stops funnet for dagens leveranser.", 403, { code: "FORBIDDEN", detail: { date, slot } });
  }

  // ---- write ----
  // NB: Tabellnavn brukt i kitchen/orders-route.ts (samme standard)
  const BATCH_TABLE = "kitchen_batches";
  const now = new Date().toISOString();

  // Bygg rows for upsert
  const rows = finalIds.map((company_location_id) => ({
    delivery_date: date,
    delivery_window: slot, // samme nøkkel som kitchen/orders (slot)
    company_location_id,
    status,
    packed_at: now,
    delivered_at: now,
  }));

  const { data: up, error: upErr } = await admin
    .from(BATCH_TABLE)
    .upsert(rows, { onConflict: "delivery_date,delivery_window,company_location_id" })
    .select("delivery_date,delivery_window,company_location_id,status,packed_at,delivered_at");

  if (upErr) {
    // Typisk: feil tabellnavn / kolonnenavn / RLS
    return jsonErr(r, "Kunne ikke oppdatere batch-status.", 500, { code: "BATCH_UPSERT_FAILED", detail: { message: upErr.message, hint: (upErr as any).hint, details: (upErr as any).details } });
  }

  return jsonOk(r, { date, slot, status, updated: (up ?? []).length, rows: up ?? [] }, 200);
}
