
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { osloTodayISODate } from "@/lib/date/oslo";

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  // scopeOr401: Response ved 401, ellers { ok:true, ctx }
  const a = await scopeOr401(req);
  if (a instanceof Response) return a;

  const ctx = a.ctx;

  // requireRoleOr403: Response ved 403, ellers ok
  // (håndhever også SCOPE_NOT_ASSIGNED for kitchen uten company/location)
  const r = requireRoleOr403(ctx, ["superadmin", "kitchen"]);
  if (r instanceof Response) return r;

  const rid = ctx.rid;

  // Tenant-scope (server truth fra profil — aldri fra query params):
  // - superadmin: eksplisitt global lesing (tilsiktet driftsoversikt)
  // - kitchen: alltid filtrert på eget company_id + location_id
  const role = String(ctx.scope?.role ?? "").trim().toLowerCase();
  const isSuperadmin = role === "superadmin";
  const companyId = String(ctx.scope?.companyId ?? "").trim();
  const locationId = String(ctx.scope?.locationId ?? "").trim();

  // Fail-closed: non-superadmin skal aldri kunne kjøre uscopet query,
  // selv om rolle-gaten over skulle endres.
  if (!isSuperadmin && (!companyId || !locationId)) {
    return jsonErr(rid, "Scope er ikke tilordnet.", 403, "SCOPE_NOT_ASSIGNED", {
      path: ctx.route ?? null,
      role,
      companyIdPresent: Boolean(companyId),
      locationIdPresent: Boolean(locationId),
    });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date") || osloTodayISODate();

  if (!isISODate(date)) {
    return jsonErr(rid, "Ugyldig dato. Bruk YYYY-MM-DD.", 400, { code: "bad_request", detail: {
      received: date,
    } });
  }

  const sb = supabaseAdmin();

  let query = sb
    .from("v_receipt_rows")
    .select("*")
    .eq("delivery_date", date);

  if (!isSuperadmin) {
    query = query.eq("company_id", companyId).eq("location_id", locationId);
  }

  const { data, error } = await query
    .order("company_name", { ascending: true })
    .order("location_name", { ascending: true })
    .order("employee_name", { ascending: true });

  if (error) {
    return jsonErr(rid, "Kunne ikke hente kvitteringsgrunnlag.", 500, { code: "db_error", detail: {
      code: error.code,
      message: error.message,
      details: error.details,
    } });
  }

  return jsonOk(rid, {
    rid,
    date,
    rows: data ?? [],
  });
}


