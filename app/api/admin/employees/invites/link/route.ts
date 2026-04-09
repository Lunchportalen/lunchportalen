// app/api/admin/employees/invites/link/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import crypto from "node:crypto";

import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";
import { auditAdmin } from "@/lib/audit/actions";
import { buildEmployeeInviteUrl } from "@/lib/invites/employeeInviteUrl";

function safeUUID(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const ok =
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(s);
  return ok ? s : null;
}

function getPublicAppUrl(): string | null {
  const env =
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;

  const s = String(env ?? "").trim();
  if (!s) return null;

  const u = s.startsWith("http") ? s : `https://${s}`;
  return u.replace(/\/+$/, "");
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.employees.invites.link", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  const actorUserId = String(scope.userId ?? "").trim();
  const actorEmail = scope.email ?? null;
  const locationId = scope.locationId ?? null;

  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const body = await readJson(req);
  const inviteId = safeUUID((body as any)?.inviteId ?? (body as any)?.id);
  if (!inviteId) return jsonErr(rid, "Ugyldig inviteId.", 400, "INVALID_INVITE_ID");

  const appUrl = getPublicAppUrl();
  if (!appUrl) {
    return jsonErr(rid, "Mangler app-url konfigurasjon.", 500, { code: "CONFIG_ERROR", detail: {
      missing: ["PUBLIC_APP_URL (eller NEXT_PUBLIC_APP_URL/NEXT_PUBLIC_SITE_URL/NEXT_PUBLIC_VERCEL_URL)"],
    } });
  }

  const admin = supabaseAdmin();

  try {
    const cur = await admin
      .from("employee_invites")
      .select("id, email, used_at")
      .eq("id", inviteId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (cur.error) return jsonErr(rid, "Kunne ikke hente invitasjon.", 500, { code: "INVITE_READ_FAILED", detail: cur.error });
    if (!cur.data) return jsonErr(rid, "Invitasjon ikke funnet.", 404, "INVITE_NOT_FOUND");
    if ((cur.data as any).used_at) return jsonErr(rid, "Invitasjonen er allerede brukt.", 400, "ALREADY_USED");

    const token = crypto.randomBytes(32).toString("hex");
    const token_hash = sha256Hex(token);
    const link = buildEmployeeInviteUrl(appUrl, token);
    const newExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

    const upd = await admin
      .from("employee_invites")
      .update({ token_hash, expires_at: newExpiry, last_sent_at: new Date().toISOString() })
      .eq("id", inviteId)
      .eq("company_id", companyId)
      .is("used_at", null);

    if (upd.error) return jsonErr(rid, "Kunne ikke oppdatere invitasjon.", 500, { code: "INVITE_UPDATE_FAILED", detail: upd.error });

    await auditAdmin({
      actor_user_id: actorUserId,
      actor_email: actorEmail,
      action: "admin.invite.copy_link",
      company_id: companyId,
      location_id: locationId,
      target_type: "employee_invite",
      target_id: inviteId,
      meta: { rid },
    });

    return jsonOk(rid, { inviteId, link }, 200);
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String(e?.message ?? e) } });
  }
}
