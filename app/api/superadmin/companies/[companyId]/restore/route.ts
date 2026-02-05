// app/api/superadmin/companies/[companyId]/restore/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { auditWriteMust } from "@/lib/audit/auditWrite";
import { logIncident } from "@/lib/observability/incident";

type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };

type Body = { confirm?: string | null };

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

function errMessage(err: any) {
  return safeStr(err?.message || err?.details || err?.hint || err?.code || "");
}

function isMissingColumn(err: any) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42703" || msg.includes("column") || msg.includes("schema cache");
}

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.restore.POST", ["superadmin"]);
  if (deny) return deny;

  const params = await Promise.resolve(ctx.params as any);
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(a.rid, "Ugyldig companyId.", 400, "BAD_REQUEST");

  const body = ((await readJson(req)) ?? {}) as Body;
  const confirm = safeStr(body?.confirm);
  if (confirm !== "GJENOPPRETT") {
    return jsonErr(a.rid, 'Bekreftelsen må være "GJENOPPRETT".', 409, "CONFIRM_MISMATCH");
  }

  const admin = supabaseAdmin();

  const companyRes = await admin
    .from("companies")
    .select("id,name,status,deleted_at,deleted_by,delete_reason")
    .eq("id", companyId)
    .maybeSingle();

  if (companyRes.error) {
    if (isMissingColumn(companyRes.error)) {
      return jsonErr(a.rid, "Mangler kolonner deleted_at/deleted_by/delete_reason i companies.", 500, "DB_ERROR");
    }
    return jsonErr(a.rid, "Kunne ikke hente firma.", 500, "DB_ERROR");
  }
  if (!companyRes.data?.id) return jsonErr(a.rid, "Fant ikke firma.", 404, "NOT_FOUND");

  if (!(companyRes.data as any).deleted_at) {
    return jsonOk(
      a.rid,
      {
        companyId,
        restored: false,
        alreadyActive: true,
        usersRestored: 0,
      },
      200
    );
  }

  const now = new Date().toISOString();

  const upd = await admin
    .from("companies")
    .update({
      status: "active",
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      updated_at: now,
    } as any)
    .eq("id", companyId)
    .select("id,deleted_at")
    .maybeSingle();

  if (upd.error) {
    return jsonErr(a.rid, "Kunne ikke gjenopprette firma.", 500, "DB_ERROR");
  }

  await auditWriteMust({
    rid: a.rid,
    action: "company.restore",
    entity_type: "company",
    entity_id: companyId,
    company_id: companyId,
    actor_user_id: a.scope?.userId ?? null,
    actor_email: a.scope?.email ?? null,
    actor_role: "superadmin",
    summary: "Superadmin gjenopprettet arkivert firma",
    detail: {
      companyId,
      before: {
        status: (companyRes.data as any)?.status ?? null,
        deleted_at: (companyRes.data as any)?.deleted_at ?? null,
      },
      after: {
        status: "active",
        deleted_at: null,
      },
    },
  });

  await logIncident({
    scope: "companies",
    severity: "info",
    rid: a.rid,
    message: "Company restored",
    meta: { companyId },
  });

  console.info("[api/superadmin/companies/restore] restored", { rid: a.rid, companyId });

  return jsonOk(
    a.rid,
    {
      companyId,
      restored: true,
      usersRestored: 0,
    },
    200
  );
}
