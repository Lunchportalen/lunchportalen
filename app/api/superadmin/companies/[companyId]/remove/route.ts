// app/api/superadmin/companies/[companyId]/remove/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";
import {
  evaluateCompanyRemovalEligibility,
  loadCompanyDependencyCounts,
  isProtectedPilotCompany,
} from "@/lib/server/superadmin/companyRemovalPolicy";
import { executeCompanyRemoval } from "@/lib/server/superadmin/executeCompanyRemoval";

type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
  );
}

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid?: string } }): Response {
  if (s?.response) return s.response;
  if (s?.res) return s.res;
  return jsonErr(String(s?.ctx?.rid ?? "rid_missing"), "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

async function requireSuperadmin(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (!gate.ok) return { ok: false as const, res: denyResponse(gate) };

  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return { ok: false as const, res: deny };

  const uid = safeStr(gate.ctx.scope.userId);
  if (!uid || !(await isSuperadminProfile(uid))) {
    return {
      ok: false as const,
      res: jsonErr(gate.ctx.rid, "Ingen tilgang.", 403, { code: "FORBIDDEN", detail: { reason: "superadmin_required" } }),
    };
  }

  return { ok: true as const, ctx: gate.ctx };
}

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.res;

  const params = await Promise.resolve(ctx.params);
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(auth.ctx.rid, "Ugyldig companyId.", 400, "BAD_REQUEST");

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin();

  const companyRes = await admin.from("companies").select("id,name,orgnr,deleted_at,status").eq("id", companyId).maybeSingle();
  if (companyRes.error || !companyRes.data?.id) {
    return jsonErr(auth.ctx.rid, "Fant ikke firma.", 404, "NOT_FOUND");
  }

  const company = companyRes.data as { name: string | null; deleted_at: string | null; orgnr: string | null };
  const dependencies = await loadCompanyDependencyCounts(admin, companyId);
  const eligibility = evaluateCompanyRemovalEligibility({
    companyName: company.name,
    orgnr: company.orgnr,
    deletedAt: company.deleted_at,
    dependencies,
  });

  return jsonOk(auth.ctx.rid, {
    companyId,
    companyName: company.name,
    orgnr: company.orgnr,
    protectedPilot: isProtectedPilotCompany(company.name),
    ...eligibility,
    archiveConfirmHint: company.orgnr ? `${company.orgnr} ARKIVER` : null,
    hardDeleteConfirmHint: company.name || company.orgnr,
  });
}

type RemoveBody = {
  mode?: "archive" | "hard_delete";
  confirmation?: string;
  reason?: string | null;
};

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.res;

  const params = await Promise.resolve(ctx.params);
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(auth.ctx.rid, "Ugyldig companyId.", 400, "BAD_REQUEST");

  const body = ((await readJson(req)) ?? {}) as RemoveBody;
  const mode = body.mode === "hard_delete" ? "hard_delete" : body.mode === "archive" ? "archive" : null;
  if (!mode) return jsonErr(auth.ctx.rid, "mode må være archive eller hard_delete.", 400, "VALIDATION");

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin();

  const result = await executeCompanyRemoval(admin, {
    rid: auth.ctx.rid,
    userId: auth.ctx.scope.userId ?? null,
    email: auth.ctx.scope.email ?? null,
  }, {
    companyId,
    mode,
    confirmation: safeStr(body.confirmation),
    reason: body.reason ?? null,
  });

  if (result.ok === false) {
    const status =
      result.code === "NOT_FOUND" ? 404
      : result.code === "CONFIRM_MISMATCH" || result.code === "VALIDATION" || result.code === "BAD_REQUEST" ? 409
      : result.code === "HARD_DELETE_BLOCKED" || result.code === "ALREADY_ARCHIVED" ? 422
      : 500;

    return jsonErr(auth.ctx.rid, result.message, status, result.code, { blockers: result.blockers ?? [] });
  }

  return jsonOk(auth.ctx.rid, { companyId: result.companyId, mode: result.mode });
}
