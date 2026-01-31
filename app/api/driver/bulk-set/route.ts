// app/api/driver/bulk-set/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { osloTodayISODate } from "@/lib/date/oslo";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type ProfileRow = { role: Role | null; disabled_at: string | null };

type BatchStatus = "queued" | "packed" | "delivered";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function rid() {
  return crypto.randomUUID();
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}
function jsonErr(status: number, r: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid: r, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normEmail(v: any) {
  return safeStr(v).toLowerCase();
}
function isHardSuperadmin(email: string | null | undefined) {
  return normEmail(email) === "superadmin@lunchportalen.no";
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
  const r = rid();

  // ---- auth ----
  const sb = await supabaseServer();

  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    return jsonErr(401, r, "NOT_AUTHENTICATED", "Ikke innlogget.");
  }

  // ---- role gate (driver/superadmin) ----
  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("role,disabled_at")
    .eq("id", user.id) // ✅ FASET
    .maybeSingle<ProfileRow>();

  if (pErr || !profile?.role) {
    return jsonErr(403, r, "FORBIDDEN", "Mangler tilgang (profile).");
  }
  if (profile.disabled_at) {
    return jsonErr(403, r, "FORBIDDEN", "Bruker er deaktivert.");
  }

  const role = String(profile.role ?? "").toLowerCase() as Role;
  const driverOk = role === "driver";
  const superOk = role === "superadmin" && isHardSuperadmin(user.email);

  if (!driverOk && !superOk) {
    return jsonErr(403, r, "FORBIDDEN", "Kun driver/superadmin har tilgang.");
  }

  // ---- input ----
  const body = await readJson(req);

  const dateRaw = safeStr(body?.date);
  const date = isIsoDate(dateRaw) ? dateRaw : osloTodayISODate();

  const slot = safeStr(body?.slot);
  const status = asStatus(body?.status);

  const locsIn = Array.isArray(body?.locationIds) ? body.locationIds : [];
  const locationIds = Array.from(new Set(locsIn.map((x: any) => safeStr(x)).filter((x: string) => isUuid(x))));

  if (!slot) return jsonErr(400, r, "VALIDATION", "Mangler slot.");
  if (!status) return jsonErr(400, r, "VALIDATION", "Ugyldig status. Bruk queued|packed|delivered.");
  if (locationIds.length === 0) return jsonErr(400, r, "VALIDATION", "Mangler locationIds (uuid).");

  // ---- write ----
  // NB: Tabellnavn brukt i kitchen/orders-route.ts (samme standard)
  const BATCH_TABLE = "kitchen_batches";
  const now = new Date().toISOString();

  // Bygg rows for upsert
  const rows = locationIds.map((company_location_id) => {
    const base = {
      delivery_date: date,
      delivery_window: slot, // samme nøkkel som kitchen/orders (slot)
      company_location_id,
      status,
    } as any;

    if (status === "queued") {
      // reset
      base.packed_at = null;
      base.delivered_at = null;
    } else if (status === "packed") {
      base.packed_at = now;
      base.delivered_at = null;
    } else if (status === "delivered") {
      base.packed_at = now; // ok hvis dere vil "auto-pack" ved delivered
      base.delivered_at = now;
    }

    return base;
  });

  const { data: up, error: upErr } = await sb
    .from(BATCH_TABLE)
    .upsert(rows, { onConflict: "delivery_date,delivery_window,company_location_id" })
    .select("delivery_date,delivery_window,company_location_id,status,packed_at,delivered_at");

  if (upErr) {
    // Typisk: feil tabellnavn / kolonnenavn / RLS
    return jsonErr(
      500,
      r,
      "BATCH_UPSERT_FAILED",
      "Kunne ikke oppdatere batch-status.",
      { message: upErr.message, hint: (upErr as any).hint, details: (upErr as any).details }
    );
  }

  return jsonOk(
    {
      ok: true,
      rid: r,
      date,
      slot,
      status,
      updated: (up ?? []).length,
      rows: up ?? [],
    },
    200
  );
}


