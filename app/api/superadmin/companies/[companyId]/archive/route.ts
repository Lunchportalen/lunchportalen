// app/api/superadmin/companies/[companyId]/archive/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { auditWriteMust } from "@/lib/audit/auditWrite";
import { logIncident } from "@/lib/observability/incident";

type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };

type Body = {
  confirm?: string | null;
  reason?: string | null;
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

function errDetail(e: any) {
  if (!e) return null;
  if (typeof e === "string") return e;
  if (e instanceof Error) return { name: e.name, message: e.message };
  try {
    return JSON.parse(JSON.stringify(e));
  } catch {
    return String(e);
  }
}

function errMessage(err: any) {
  return safeStr(err?.message || err?.details || err?.hint || err?.code || "");
}

function isMissingColumn(err: any) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42703" || msg.includes("column") || msg.includes("schema cache");
}

function logSbError(tag: string, err: any) {
  if (!err) return;
  console.error(`[api/superadmin/companies/archive] ${tag}`, {
    code: err?.code,
    message: err?.message,
    details: err?.details,
    hint: err?.hint,
  });
}

function isAuthUserMissing(err: any) {
  const msg = String(err?.message ?? "").toLowerCase();
  const status = Number(err?.status ?? err?.statusCode ?? 0);
  return status === 404 || msg.includes("not found") || msg.includes("user not found");
}

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.archive.POST", ["superadmin"]);
  if (deny) return deny;

  const params = await Promise.resolve(ctx.params as any);
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(a.rid, "Ugyldig companyId.", 400, "BAD_REQUEST");

  const body = ((await readJson(req)) ?? {}) as Body;
  const confirmRaw = String(body?.confirm ?? "");
  const reason = safeStr(body?.reason).slice(0, 500) || null;

  const admin = supabaseAdmin();

  const companyRes = await admin
    .from("companies")
    .select("id,name,orgnr,deleted_at,deleted_by,delete_reason,status")
    .eq("id", companyId)
    .maybeSingle();

  if (companyRes.error) {
    logSbError("company.lookup", companyRes.error);
    if (isMissingColumn(companyRes.error)) {
      return jsonErr(a.rid, "Mangler kolonner deleted_at/deleted_by/delete_reason i companies.", 500, "DB_ERROR");
    }
    return jsonErr(a.rid, "Kunne ikke hente firma.", 500, "DB_ERROR");
  }
  if (!companyRes.data?.id) return jsonErr(a.rid, "Fant ikke firma.", 404, "NOT_FOUND");

  const companyOrgnr = safeStr((companyRes.data as any).orgnr);
  if (!companyOrgnr) {
    return jsonErr(a.rid, "Firma mangler org.nr og kan ikke arkiveres.", 400, "BAD_REQUEST");
  }

  const expectedConfirm = `${companyOrgnr} SLETT`;
  if (confirmRaw !== expectedConfirm) {
    return jsonErr(a.rid, `Bekreftelsen må være "${expectedConfirm}".`, 409, "CONFIRM_MISMATCH");
  }

  if ((companyRes.data as any)?.deleted_at) {
    return jsonOk(
      a.rid,
      {
        companyId,
        archived: true,
        alreadyArchived: true,
        authUsersTargeted: 0,
        authUsersDeleted: 0,
      },
      200
    );
  }

  const profRes = await admin.from("profiles").select("user_id").eq("company_id", companyId);
  if (profRes.error) {
    logSbError("profiles.lookup", profRes.error);
    return jsonErr(a.rid, "Kunne ikke hente ansatte for tilgangs-sperre.", 500, "DB_ERROR");
  }

  const userIds = Array.from(
    new Set((profRes.data ?? []).map((r: any) => safeStr(r?.user_id)).filter(Boolean))
  );

  let authUsersDeleted = 0;

  for (const uid of userIds) {
    const del = await admin.auth.admin.deleteUser(uid);
    if (del?.error) {
      if (isAuthUserMissing(del.error)) {
        console.error("[api/superadmin/companies/archive] auth user already missing", {
          user_id: uid,
          error: errDetail(del.error),
        });
        continue;
      }
      logSbError("auth.delete", del.error);
      return jsonErr(a.rid, "Kunne ikke fjerne auth-tilgang.", 500, "DB_ERROR");
    }
    authUsersDeleted += 1;
  }

  const now = new Date().toISOString();

  const companyUpdate = await admin
    .from("companies")
    .update({
      status: "closed",
      deleted_at: now,
      deleted_by: a.scope?.userId ?? null,
      delete_reason: reason,
    } as any)
    .eq("id", companyId)
    .select("id,deleted_at")
    .maybeSingle();

  if (companyUpdate.error) {
    logSbError("company.archive", companyUpdate.error);
    return jsonErr(a.rid, "Kunne ikke arkivere firma.", 500, "DB_ERROR");
  }

  try {
    await auditWriteMust({
      rid: a.rid,
      action: "company.archive",
      entity_type: "company",
      entity_id: companyId,
      company_id: companyId,
      actor_user_id: a.scope?.userId ?? null,
      actor_email: a.scope?.email ?? null,
      actor_role: "superadmin",
      summary: "Superadmin arkiverte firma",
      detail: {
        companyId,
        reason,
        authUsersTargeted: userIds.length,
        authUsersDeleted,
      },
    });
  } catch (e: any) {
    return jsonErr(a.rid, "Kunne ikke skrive audit for arkivering.", 500, { code: "AUDIT_FAILED", detail: String(e?.message ?? e) });
  }

  await logIncident({
    scope: "companies",
    severity: "info",
    rid: a.rid,
    message: "Company archived",
    meta: { companyId, reason, authUsersDeleted, authUsersTargeted: userIds.length },
  });

  console.info("[api/superadmin/companies/archive] archived", { rid: a.rid, companyId });

  return jsonOk(
    a.rid,
    {
      companyId,
      archived: true,
      alreadyArchived: false,
      authUsersTargeted: userIds.length,
      authUsersDeleted,
    },
    200
  );
}
