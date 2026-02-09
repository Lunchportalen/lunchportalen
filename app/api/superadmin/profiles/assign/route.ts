// app/api/superadmin/profiles/assign/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function normEmail(v: any) {
  return safeStr(v).toLowerCase();
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

type Role = "employee" | "company_admin";

function normRole(v: any): Role {
  const s = safeStr(v).toLowerCase();
  if (s === "company_admin") return "company_admin";
  return "employee";
}

export async function POST(req: NextRequest): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.profiles.assign.POST", ["superadmin"]);
  if (deny) return deny;

  const body = (await readJson(req)) ?? {};

  const email = normEmail(body?.email);
  const companyId = safeStr(body?.companyId);
  const locationIdRaw = safeStr(body?.locationId);
  const locationId = locationIdRaw ? locationIdRaw : null;

  const role: Role = normRole(body?.role);
  const is_active = body?.is_active === false ? false : true;

  if (!email || !email.includes("@")) return jsonErr(ctx.rid, "Ugyldig e-post.", 400, "BAD_REQUEST");
  if (!isUuid(companyId)) return jsonErr(ctx.rid, "Ugyldig companyId.", 400, "BAD_REQUEST");
  if (locationId && !isUuid(locationId)) return jsonErr(ctx.rid, "Ugyldig locationId.", 400, "BAD_REQUEST");

  const admin = supabaseAdmin();

  // Call RPC (security definer / service_role execute)
  const { data, error } = await admin.rpc("superadmin_assign_profile_to_company", {
    p_email: email,
    p_company_id: companyId,
    p_location_id: locationId,
    p_role: role,
    p_is_active: is_active,
  });

  if (error) {
    const msg = String(error.message || "");
    // Map known errors from RPC to cleaner messages
    if (msg.includes("profile_not_found")) return jsonErr(ctx.rid, "Fant ikke profil for e-post.", 404, "NOT_FOUND");
    if (msg.includes("company_not_found")) return jsonErr(ctx.rid, "Fant ikke firma.", 404, "NOT_FOUND");
    if (msg.includes("location_not_in_company")) return jsonErr(ctx.rid, "Lokasjon tilhører ikke firma.", 400, "BAD_REQUEST");

    return jsonErr(ctx.rid, "Kunne ikke knytte ansatt til firma.", 500, {
      code: "RPC_ERROR",
      detail: { message: error.message, hint: (error as any).hint, code: (error as any).code },
    });
  }

  // Supabase rpc can return array or single depending on definition
  const profile = Array.isArray(data) ? data[0] : data;

  return jsonOk(ctx.rid, { profile }, 200);
}
