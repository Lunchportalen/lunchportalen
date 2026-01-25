// app/api/admin/locations/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function noStore() {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

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

/**
 * Hent innlogget user + profile og verifiser at han er company_admin.
 * Viktig: company_id hentes fra DB, aldri fra klient.
 */
async function requireCompanyAdmin() {
  const sb = await supabaseServer();

  const { data: auth, error: uerr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (uerr || !user) throw Object.assign(new Error("not_authenticated"), { code: "not_authenticated" });

  const { data: profile, error: perr } = await sb
    .from("profiles")
    .select("user_id, company_id, role, email, disabled_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (perr) throw Object.assign(new Error("db_error"), { code: "db_error", detail: perr });

  if (profile?.disabled_at) throw Object.assign(new Error("account_disabled"), { code: "account_disabled" });

  const roleDb = String(profile?.role ?? "").trim().toLowerCase();
  const roleMeta = String(user.user_metadata?.role ?? "").trim().toLowerCase();
  const role = (roleDb || roleMeta || "employee") as Role;

  if (role !== "company_admin") throw Object.assign(new Error("forbidden"), { code: "forbidden" });

  const companyId = profile?.company_id ? String(profile.company_id) : "";
  if (!companyId) throw Object.assign(new Error("missing_company"), { code: "missing_company" });

  return {
    user,
    companyId,
    actorEmail: user.email ?? profile?.email ?? null,
  };
}

export async function GET(req: Request) {
  const rid = `loc_list_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { companyId } = await requireCompanyAdmin();
    const admin = supabaseAdmin();

    const url = new URL(req.url);

    // UI kan sende companyId – men vi ignorerer den (tenant-safe)
    const page = safeInt(url.searchParams.get("page"), 1, 1, 10_000);
    const limit = safeInt(url.searchParams.get("limit"), 50, 1, 200);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    /**
     * Viktig:
     * I ditt miljø finnes ikke kolonnen company_locations.contact_name (ref: 42703).
     * Derfor henter vi * og mapper med fallback.
     */
    const { data, error, count } = await admin
      .from("company_locations")
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return jsonError(500, "locations_list_failed", "Kunne ikke hente lokasjoner.", { rid, detail: error });
    }

    const locations = (data ?? []).map((r: any) => ({
      id: String(r.id),
      company_id: r.company_id ? String(r.company_id) : null,

      // Navn
      name: pick(r, ["name", "title", "location_name"]) ?? null,

      // Kontakt (ulike mulige feltnavn)
      contact_name: pick(r, ["contact_name", "contact", "delivery_contact", "leveringskontakt"]) ?? null,
      contact_phone: pick(r, ["contact_phone", "phone", "telephone", "contact_tlf", "leveringstelefon"]) ?? null,

      // Leveringsvindu (ulike mulige feltnavn)
      window_from: pick(r, ["window_from", "from", "time_from", "vindu_fra"]) ?? null,
      window_to: pick(r, ["window_to", "to", "time_to", "vindu_til"]) ?? null,

      // Notater
      notes: pick(r, ["notes", "note", "comment", "notater"]) ?? null,

      created_at: r.created_at ?? null,
      updated_at: r.updated_at ?? null,
    }));

    return jsonOk({
      ok: true,
      rid,
      companyId,
      page,
      limit,
      total: Number(count ?? 0),
      locations,
      // Debug-hint ved behov (kan fjernes senere)
      _info: { selected: "* (schema-safe mapper)", note: "Fallback mapping to avoid missing columns." },
    });
  } catch (e: any) {
    const code = e?.code || "unknown";

    if (code === "not_authenticated") return jsonError(401, "not_authenticated", "Du må være innlogget.", { rid });
    if (code === "account_disabled") return jsonError(403, "account_disabled", "Kontoen er deaktivert.", { rid });
    if (code === "forbidden") return jsonError(403, "forbidden", "Ingen tilgang.", { rid });
    if (code === "missing_company")
      return jsonError(400, "missing_company", "Mangler company_id på admin-profilen.", { rid });
    if (code === "db_error") return jsonError(500, "db_error", "Databasefeil.", { rid, detail: e?.detail });

    return jsonError(500, "server_error", "Uventet feil.", { rid, detail: String(e?.message ?? e) });
  }
}
