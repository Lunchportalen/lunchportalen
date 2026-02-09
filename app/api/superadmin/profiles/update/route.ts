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

function normRole(v: any): Role | null {
  const s = safeStr(v).toLowerCase();
  if (s === "employee" || s === "company_admin") return s;
  return null;
}

export async function POST(req: NextRequest): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.profiles.update.POST", ["superadmin"]);
  if (deny) return deny;

  const body = (await readJson(req)) ?? {};

  /**
   * Identification (ONE is required)
   * - profileId OR userId OR email
   */
  const profileId = safeStr(body.profileId);
  const userId = safeStr(body.userId);
  const email = normEmail(body.email);

  if (!profileId && !userId && !email) {
    return jsonErr(ctx.rid, "Mangler identifikator (profileId | userId | email).", 400, "BAD_REQUEST");
  }

  /**
   * Allowed updates
   */
  const role = body.role !== undefined ? normRole(body.role) : null;
  const is_active = body.is_active !== undefined ? Boolean(body.is_active) : null;

  if (role === null && is_active === null) {
    return jsonErr(ctx.rid, "Ingen gyldige felter å oppdatere.", 400, "BAD_REQUEST");
  }

  if (profileId && !isUuid(profileId)) {
    return jsonErr(ctx.rid, "Ugyldig profileId.", 400, "BAD_REQUEST");
  }
  if (userId && !isUuid(userId)) {
    return jsonErr(ctx.rid, "Ugyldig userId.", 400, "BAD_REQUEST");
  }
  if (email && !email.includes("@")) {
    return jsonErr(ctx.rid, "Ugyldig e-post.", 400, "BAD_REQUEST");
  }

  const admin = supabaseAdmin();

  /**
   * Resolve profile
   */
  let q = admin.from("profiles").select("id,email,role,is_active").limit(1);

  if (profileId) q = q.eq("id", profileId);
  else if (userId) q = q.eq("user_id", userId);
  else q = q.eq("email", email);

  const { data: profile, error: findErr } = await q.maybeSingle();

  if (findErr) {
    return jsonErr(ctx.rid, "Kunne ikke finne profil.", 500, findErr);
  }
  if (!profile) {
    return jsonErr(ctx.rid, "Fant ikke profil.", 404, "NOT_FOUND");
  }

  /**
   * Build update payload
   * IMPORTANT: company_id is NEVER touched here
   */
  const update: Record<string, any> = {};
  if (role !== null) update.role = role;
  if (is_active !== null) update.is_active = is_active;

  const { data: updated, error: updErr } = await admin
    .from("profiles")
    .update(update)
    .eq("id", profile.id)
    .select("id,email,role,is_active")
    .single();

  if (updErr) {
    return jsonErr(ctx.rid, "Kunne ikke oppdatere profil.", 500, {
      code: "DB_ERROR",
      detail: updErr,
    });
  }

  return jsonOk(
    ctx.rid,
    {
      profile: updated,
    },
    200
  );
}
