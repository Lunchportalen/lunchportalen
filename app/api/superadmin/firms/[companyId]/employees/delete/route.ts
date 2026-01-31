// app/api/superadmin/firms/[companyId]/employees/delete/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function norm(v: any) {
  return safeStr(v).toLowerCase();
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function isProtectedSystemEmail(email: string) {
  const e = norm(email);
  return e === "superadmin@lunchportalen.no" || e === "kjokken@lunchportalen.no" || e === "driver@lunchportalen.no";
}

type Ctx = { params: { companyId: string } | Promise<{ companyId: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = await scopeOr401(req);
  if (!s?.ok) return (s?.response as Response) || (s?.res as Response) || jsonErr(401, { rid: "rid_missing" }, "UNAUTHENTICATED", "Du må være innlogget.");

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.firms.employees.delete.POST", ["superadmin"]);
  if (deny) return deny;

  const params = await ctx.params;
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(400, a, "BAD_REQUEST", "Ugyldig companyId.");

  const body = (await readJson(req)) ?? {};
  const user_id = safeStr(body?.user_id);

  if (!isUuid(user_id)) return jsonErr(400, a, "BAD_REQUEST", "Ugyldig user_id.", { user_id });

  try {
    const admin = supabaseAdmin();

    // Les profil for å verifisere firma-tilhørighet
    const prof = await admin
      .from("profiles")
      .select("user_id,email,company_id,role")
      .eq("user_id", user_id)
      .maybeSingle();

    if (prof.error) return jsonErr(500, a, "DB_ERROR", "Kunne ikke lese profil.", prof.error);
    if (!prof.data) return jsonErr(404, a, "NOT_FOUND", "Fant ikke bruker/profil.");

    const email = safeStr(prof.data.email ?? "");
    if (email && isProtectedSystemEmail(email)) {
      return jsonErr(403, a, "PROTECTED_ACCOUNT", "Systemkonto kan ikke slettes.");
    }

    if (safeStr(prof.data.company_id) !== companyId) {
      return jsonErr(403, a, "TENANT_MISMATCH", "Bruker tilhører ikke dette firmaet.", {
        companyId,
        profileCompanyId: safeStr(prof.data.company_id),
      });
    }

    // 1) Slett pending invites for epost (clean-up)
    if (email) {
      await admin.from("employee_invites").delete().eq("email", email);
    }

    // 2) Slett profil
    const delProf = await admin.from("profiles").delete().eq("user_id", user_id);
    if (delProf.error) return jsonErr(500, a, "DB_ERROR", "Kunne ikke slette profil.", delProf.error);

    // 3) Slett auth-user
    const delAuth = await admin.auth.admin.deleteUser(user_id);
    if ((delAuth as any)?.error) {
      return jsonErr(
        500,
        a,
        "AUTH_DELETE_FAILED",
        "Profil slettet, men auth-user kunne ikke slettes.",
        (delAuth as any).error
      );
    }

    return jsonOk(a, { ok: true, rid: a.rid, message: "Bruker slettet." }, 200);
  } catch (e: any) {
    return jsonErr(500, a, "SERVER_ERROR", "Kunne ikke slette bruker.", { message: String(e?.message ?? e) });
  }
}

