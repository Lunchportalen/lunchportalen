// app/api/superadmin/employees/[userId]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson, q } from "@/lib/http/routeGuard";
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

function pickCompanyId(req: NextRequest, body: any) {
  return (
    safeStr(q(req, "companyId") ?? q(req, "company_id") ?? body?.companyId ?? body?.company_id) || null
  );
}

function pickMode(req: NextRequest, body: any): "soft" | "hard" {
  const raw = safeStr(q(req, "mode") ?? body?.mode);
  return raw.toLowerCase() === "hard" ? "hard" : "soft";
}

type RouteCtx = { params: { userId: string } | Promise<{ userId: string }> };

export async function PATCH(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const ctxAuth = gate.ctx;

  const deny = requireRoleOr403(ctxAuth, "api.superadmin.employees.PATCH", ["superadmin"]);
  if (deny) return deny;

  const params = await ctx.params;
  const userId = safeStr(params?.userId);
  if (!isUuid(userId)) return jsonErr(ctxAuth.rid, "Ugyldig userId.", 400, "INVALID_USER_ID");

  const body = await readJson(req);
  const companyId = pickCompanyId(req, body);
  if (!companyId || !isUuid(companyId)) return jsonErr(ctxAuth.rid, "Ugyldig companyId.", 400, "INVALID_COMPANY_ID");

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = supabaseAdmin();

    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("user_id,company_id,role,email,name,full_name,is_active,disabled_at,deleted_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (profErr) return jsonErr(ctxAuth.rid, "Kunne ikke lese profil.", 500, { code: "PROFILE_READ_FAILED", detail: profErr });
    if (!prof) return jsonErr(ctxAuth.rid, "Fant ikke bruker.", 404, "NOT_FOUND");

    if (safeStr((prof as any).company_id) !== companyId) {
      return jsonErr(ctxAuth.rid, "Bruker tilhører ikke dette firmaet.", 403, { code: "TENANT_MISMATCH", detail: {
        companyId,
        profileCompanyId: safeStr((prof as any).company_id),
      } });
    }

    if ((prof as any).deleted_at) {
      return jsonOk(ctxAuth.rid, {
        mode: "soft",
        userId,
        companyId,
        idempotent: true,
        status: "deleted",
      });
    }

    if (safeStr((prof as any).role).toLowerCase() !== "employee") {
      return jsonErr(ctxAuth.rid, "Kun ansatte (employee) kan deaktiveres.", 403, "FORBIDDEN_ROLE");
    }

    if ((prof as any).disabled_at || (prof as any).is_active === false) {
      return jsonOk(ctxAuth.rid, {
        mode: "soft",
        userId,
        companyId,
        idempotent: true,
        status: "deactivated",
      });
    }

    const disabledAt = new Date().toISOString();

    const { data: updated, error: updErr } = await admin
      .from("profiles")
      .update({
        is_active: false,
        disabled_at: disabledAt,
        disabled_reason: "Deaktivert av superadmin",
      })
      .eq("user_id", userId)
      .select("user_id,company_id,role,email,name,full_name,is_active,disabled_at,deleted_at")
      .maybeSingle();

    if (updErr) return jsonErr(ctxAuth.rid, "Kunne ikke deaktivere ansatt.", 500, { code: "PROFILE_UPDATE_FAILED", detail: updErr });

    await auditWriteMust({
      rid: ctxAuth.rid,
      action: "employee.deactivate",
      entity_type: "profile",
      entity_id: userId,
      company_id: companyId,
      actor_user_id: ctxAuth.scope.userId ?? null,
      actor_email: ctxAuth.scope.email ?? null,
      actor_role: "superadmin",
      summary: "Superadmin deaktiverte ansatt",
      detail: {
        mode: "deactivate",
        userId,
        companyId,
        before: {
          is_active: (prof as any).is_active ?? null,
          disabled_at: (prof as any).disabled_at ?? null,
        },
        after: {
          is_active: (updated as any)?.is_active ?? false,
          disabled_at: (updated as any)?.disabled_at ?? disabledAt,
        },
      },
    });

    return jsonOk(ctxAuth.rid, { mode: "deactivate", userId, companyId });
  } catch (e: any) {
    return jsonErr(ctxAuth.rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: safeStr(e?.message ?? e) } });
  }
}

export async function DELETE(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const ctxAuth = gate.ctx;

  const deny = requireRoleOr403(ctxAuth, "api.superadmin.employees.DELETE", ["superadmin"]);
  if (deny) return deny;

  const params = await ctx.params;
  const userId = safeStr(params?.userId);
  if (!isUuid(userId)) return jsonErr(ctxAuth.rid, "Ugyldig userId.", 400, "INVALID_USER_ID");

  const body = await readJson(req);
  const companyId = pickCompanyId(req, body);
  if (!companyId || !isUuid(companyId)) return jsonErr(ctxAuth.rid, "Ugyldig companyId.", 400, "INVALID_COMPANY_ID");

  const mode = pickMode(req, body);

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = supabaseAdmin();

    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("user_id,company_id,role,email,name,full_name,phone,is_active,disabled_at,deleted_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (profErr) return jsonErr(ctxAuth.rid, "Kunne ikke lese profil.", 500, { code: "PROFILE_READ_FAILED", detail: profErr });
    if (!prof) return jsonErr(ctxAuth.rid, "Fant ikke bruker.", 404, "NOT_FOUND");

    if (safeStr((prof as any).company_id) !== companyId) {
      return jsonErr(ctxAuth.rid, "Bruker tilhører ikke dette firmaet.", 403, { code: "TENANT_MISMATCH", detail: {
        companyId,
        profileCompanyId: safeStr((prof as any).company_id),
      } });
    }

    if ((prof as any).deleted_at) {
      return jsonOk(ctxAuth.rid, { mode, userId, companyId, idempotent: true });
    }

    if (safeStr((prof as any).role).toLowerCase() !== "employee") {
      return jsonErr(ctxAuth.rid, "Kun ansatte (employee) kan slettes.", 403, "FORBIDDEN_ROLE");
    }

    if (mode === "hard") {
      const { count, error: countErr } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("company_id", companyId);

      if (countErr) return jsonErr(ctxAuth.rid, "Kunne ikke sjekke ordre.", 500, { code: "ORDERS_COUNT_FAILED", detail: countErr });

      if (Number(count ?? 0) > 0) {
        return jsonErr(
          ctxAuth.rid,
          "User has existing orders. Hard delete is not allowed.",
          409,
          "DELETE_BLOCKED"
        );
      }

      const email = safeStr((prof as any).email ?? "");
      if (email) {
        await admin.from("employee_invites").delete().eq("email", email);
      }

      const delProf = await admin.from("profiles").delete().eq("user_id", userId);
      if (delProf.error) return jsonErr(ctxAuth.rid, "Kunne ikke slette profil.", 500, { code: "PROFILE_DELETE_FAILED", detail: delProf.error });

      const delAuth = await admin.auth.admin.deleteUser(userId);
      if ((delAuth as any)?.error) {
        return jsonErr(ctxAuth.rid, "Profil slettet, men auth-user kunne ikke slettes.", 500, { code: "AUTH_DELETE_FAILED", detail: (delAuth as any).error });
      }

      await auditWriteMust({
        rid: ctxAuth.rid,
        action: "employee.delete",
        entity_type: "profile",
        entity_id: userId,
        company_id: companyId,
        actor_user_id: ctxAuth.scope.userId ?? null,
        actor_email: ctxAuth.scope.email ?? null,
        actor_role: "superadmin",
        summary: "Superadmin hard-slettet ansatt",
        detail: {
          mode: "hard",
          userId,
          companyId,
          before: {
            email: (prof as any).email ?? null,
            name: (prof as any).name ?? null,
            full_name: (prof as any).full_name ?? null,
            role: (prof as any).role ?? null,
          },
          after: null,
        },
      });

      return jsonOk(ctxAuth.rid, { mode: "hard", userId, companyId });
    }

    const deletedAt = new Date().toISOString();
    const anonymizedEmail = `deleted+${userId}@lunchportalen.invalid`;

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
      .eq("user_id", userId)
      .select("user_id,company_id,role,email,name,full_name,is_active,disabled_at,deleted_at")
      .maybeSingle();

    if (updErr) return jsonErr(ctxAuth.rid, "Kunne ikke slette bruker.", 500, { code: "SOFT_DELETE_FAILED", detail: updErr });

    await auditWriteMust({
      rid: ctxAuth.rid,
      action: "employee.delete",
      entity_type: "profile",
      entity_id: userId,
      company_id: companyId,
      actor_user_id: ctxAuth.scope.userId ?? null,
      actor_email: ctxAuth.scope.email ?? null,
      actor_role: "superadmin",
      summary: "Superadmin soft-slettet ansatt",
      detail: {
        mode: "soft",
        userId,
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

    return jsonOk(ctxAuth.rid, { mode: "soft", userId, companyId });
  } catch (e: any) {
    return jsonErr(ctxAuth.rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: safeStr(e?.message ?? e) } });
  }
}
