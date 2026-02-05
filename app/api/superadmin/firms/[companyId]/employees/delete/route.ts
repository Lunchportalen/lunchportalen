// app/api/superadmin/firms/[companyId]/employees/delete/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { auditWriteMust } from "@/lib/audit/auditWrite";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

type Ctx = { params: { companyId: string } | Promise<{ companyId: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const a = gate.ctx;

  const deny = requireRoleOr403(a, "api.superadmin.firms.employees.delete.POST", ["superadmin"]);
  if (deny) return deny;

  const params = await ctx.params;
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(a.rid, "Ugyldig companyId.", 400, "BAD_REQUEST");

  const body = (await readJson(req)) ?? {};
  const user_id = safeStr((body as any)?.user_id);

  if (!isUuid(user_id)) return jsonErr(a.rid, "Ugyldig user_id.", 400, { code: "BAD_REQUEST", detail: { user_id } });

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = supabaseAdmin();

    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("user_id,email,company_id,role,name,full_name,deleted_at")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profErr) return jsonErr(a.rid, "Kunne ikke lese profil.", 500, { code: "DB_ERROR", detail: profErr });
    if (!prof) return jsonErr(a.rid, "Fant ikke bruker/profil.", 404, "NOT_FOUND");

    if (safeStr((prof as any).company_id) !== companyId) {
      return jsonErr(a.rid, "Bruker tilhører ikke dette firmaet.", 403, {
        code: "TENANT_MISMATCH",
        detail: { companyId, profileCompanyId: safeStr((prof as any).company_id) },
      });
    }

    if ((prof as any).deleted_at) {
      return jsonOk(a.rid, { mode: "soft", userId: user_id, companyId, idempotent: true }, 200);
    }

    if (safeStr((prof as any).role).toLowerCase() !== "employee") {
      return jsonErr(a.rid, "Kun ansatte (employee) kan slettes.", 403, "FORBIDDEN_ROLE");
    }

    const deletedAt = new Date().toISOString();
    const anonymizedEmail = `deleted+${user_id}@lunchportalen.invalid`;

    const { data: updated, error: updErr } = await admin
      .from("profiles")
      .update({
        is_active: false,
        disabled_at: deletedAt,
        disabled_reason: "Slettet av superadmin",
        deleted_at: deletedAt,
        role: null,
        name: "Deleted user",
        full_name: "Deleted user",
        email: anonymizedEmail,
        phone: null,
      })
      .eq("user_id", user_id)
      .select("user_id,company_id,role,email,name,full_name,deleted_at")
      .maybeSingle();

    if (updErr) return jsonErr(a.rid, "Kunne ikke slette bruker.", 500, { code: "SOFT_DELETE_FAILED", detail: updErr });

    await auditWriteMust({
      rid: a.rid,
      action: "employee.delete",
      entity_type: "profile",
      entity_id: user_id,
      company_id: companyId,
      actor_user_id: a.scope.userId ?? null,
      actor_email: a.scope.email ?? null,
      actor_role: "superadmin",
      summary: "Superadmin soft-slettet ansatt",
      detail: {
        mode: "soft",
        userId: user_id,
        companyId,
        before: {
          email: (prof as any).email ?? null,
          name: (prof as any).name ?? null,
          full_name: (prof as any).full_name ?? null,
          role: (prof as any).role ?? null,
        },
        after: {
          email: (updated as any)?.email ?? anonymizedEmail,
          name: (updated as any)?.name ?? "Deleted user",
          full_name: (updated as any)?.full_name ?? "Deleted user",
          role: (updated as any)?.role ?? null,
          deleted_at: (updated as any)?.deleted_at ?? deletedAt,
        },
      },
    });

    return jsonOk(a.rid, { mode: "soft", userId: user_id, companyId }, 200);
  } catch (e: any) {
    return jsonErr(a.rid, "Kunne ikke slette bruker.", 500, { code: "SERVER_ERROR", detail: { message: safeStr(e?.message ?? e) } });
  }
}
