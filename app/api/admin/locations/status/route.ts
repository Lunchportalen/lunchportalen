// app/api/admin/locations/status/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function normalizeStatus(v: any) {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE" || s === "INACTIVE") return s;
  return null;
}

export async function POST(req: NextRequest): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return s.res ?? s.response;

  const a = s.ctx;
  const denyRole = requireRoleOr403(a, "admin.locations.status", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a);
  if (denyScope) return denyScope;

  const body = (await readJson(req)) ?? {};
  const bodyIsObject = !!body && typeof body === "object" && !Array.isArray(body);
  if (!bodyIsObject) return jsonErr(a.rid, "Ugyldig body.", 400, "BAD_REQUEST");

  const locationId = safeStr((body as any)?.locationId ?? (body as any)?.location_id ?? (body as any)?.id);
  if (!isUuid(locationId)) return jsonErr(a.rid, "Ugyldig locationId.", 400, "BAD_REQUEST");

  const status = normalizeStatus((body as any)?.status);
  if (!status) return jsonErr(a.rid, "Status må være ACTIVE eller INACTIVE.", 400, "BAD_REQUEST");

  const companyId = safeStr(a.scope?.companyId);
  if (!companyId) return jsonErr(a.rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const admin = supabaseAdmin();

  const existing = await admin
    .from("company_locations")
    .select("id,company_id,status")
    .eq("id", locationId)
    .maybeSingle();

  if (existing.error) {
    return jsonErr(a.rid, "Kunne ikke hente lokasjon.", 500, { code: "DB_ERROR", detail: existing.error });
  }

  if (!existing.data?.id) return jsonErr(a.rid, "Fant ikke lokasjon.", 404, "NOT_FOUND");

  if (safeStr((existing.data as any)?.company_id) !== companyId) {
    return jsonErr(a.rid, "Ingen tilgang til lokasjon.", 403, "FORBIDDEN");
  }

  const upd = await admin
    .from("company_locations")
    .update({ status } as any)
    .eq("id", locationId)
    .select("id,status")
    .maybeSingle();

  if (upd.error) {
    return jsonErr(a.rid, "Kunne ikke oppdatere lokasjon.", 500, { code: "DB_ERROR", detail: upd.error });
  }

  return jsonOk(a.rid, {
    location: {
      id: locationId,
      status: upd.data?.status ?? status,
    },
  });
}
