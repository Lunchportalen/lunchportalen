// app/api/admin/employees/invites/revoke/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

function safeUUID(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const ok =
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(s);
  return ok ? s : null;
}

export async function POST(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.employees.invites.revoke", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  if (!companyId) return jsonErr(409, rid, "SCOPE_MISSING", "Mangler companyId i scope.");

  const body = await readJson(req);
  const inviteId = safeUUID((body as any)?.inviteId ?? (body as any)?.id);
  if (!inviteId) return jsonErr(400, rid, "INVALID_INVITE_ID", "Ugyldig inviteId.");

  try {
    const admin = supabaseAdmin();

    const del = await admin
      .from("employee_invites")
      .delete()
      .eq("id", inviteId)
      .eq("company_id", companyId)
      .is("used_at", null);

    if (del.error) return jsonErr(500, rid, "REVOKE_FAILED", "Kunne ikke trekke tilbake invitasjonen.", del.error);

    return jsonOk({ ok: true, rid, message: "Invitasjon trukket tilbake." });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}
