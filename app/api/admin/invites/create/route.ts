// app/api/admin/invites/create/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import crypto from "node:crypto";


// ✅ Dag-10 helpers
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

function randomCode(bytes = 18) {
  // URL-safe code (typisk 24 tegn)
  return crypto.randomBytes(bytes).toString("base64url");
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  // 1) Scope (NY SIGNATUR: Response | { ok:true, ctx })
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;
  const ctx = a.ctx;

  // 2) Kun company_admin (NY SIGNATUR)
  const denyRole = requireRoleOr403(ctx, "admin.invites.create", ["company_admin"]);
  if (denyRole) return denyRole;

  // 3) Må ha company scope (NY SIGNATUR)
  const denyScope = requireCompanyScopeOr403(ctx);
  if (denyScope) return denyScope;

  const userId = safeStr(ctx.scope.userId);
  const companyId = safeStr(ctx.scope.companyId);

  if (!userId) return jsonErr(ctx.rid, "Ikke innlogget.", 400, "not_authenticated");
  if (!companyId) return jsonErr(ctx.rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  try {
    const admin = supabaseAdmin();

    // Revoke gamle aktive invites (én gjeldende lenke per firma)
    const revokeRes = await admin
      .from("company_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .is("revoked_at", null);

    if (revokeRes.error) {
      return jsonErr(ctx.rid, "Kunne ikke deaktivere tidligere invitasjoner.", 400, { code: "invite_revoke_failed", detail: {
        message: revokeRes.error.message,
      } });
    }

    // Lag ny invite
    const code = randomCode(18);

    const { data: inv, error: iErr } = await admin
      .from("company_invites")
      .insert({ company_id: companyId, code, created_by: userId })
      .select("code, company_id, created_at")
      .single();

    if (iErr || !inv) {
      return jsonErr(ctx.rid, "Kunne ikke opprette invitasjonslenke.", 400, { code: "invite_create_failed", detail: {
        message: iErr?.message ?? "unknown",
      } });
    }

    const base = safeStr(process.env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, "") || "http://localhost:3000";
    const url = `${base}/register?invite=${encodeURIComponent(inv.code)}`;

    return jsonOk(ctx.rid, {
      ok: true,
      invite: { code: inv.code, url, created_at: inv.created_at, company_id: inv.company_id },
    });
  } catch (e: any) {
    return jsonErr(ctx.rid, "Uventet feil ved opprettelse av invitasjon.", 400, { code: "server_error", detail: {
      message: String(e?.message ?? e),
    } });
  }
}
