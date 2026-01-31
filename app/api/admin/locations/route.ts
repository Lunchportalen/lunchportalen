// app/api/admin/locations/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

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
  if (!companyId) return jsonErr(409, rid, "SCOPE_MISSING", "Mangler company_id i scope.");

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
      return jsonErr(500, rid, "LOCATIONS_LIST_FAILED", "Kunne ikke hente lokasjoner.", { message: error.message });
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
      _info: { selected: "* (schema-safe mapper)", note: "Fallback mapping to avoid missing columns." },
    });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", String(e?.message ?? "Unknown error"), { at: "admin/locations" });
  }
}


