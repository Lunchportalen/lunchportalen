export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { createAgreementDraftFromRegistration } from "@/lib/server/superadmin/createAgreementDraftFromRegistration";

type Ctx = { params: { companyId: string } | Promise<{ companyId: string }> };

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

/**
 * POST /api/superadmin/company-registrations/:companyId/create-agreement-draft
 * Canonical: lp_agreement_create_pending (samme som POST /api/superadmin/agreements), trigget fra registrering.
 */
export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  void req;
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const authCtx = s.ctx;
  const deny = requireRoleOr403(authCtx, "superadmin.agreements.create", ["superadmin"]);
  if (deny) return deny;

  const params = await Promise.resolve(ctx.params as { companyId?: string });
  const companyId = String(params?.companyId ?? "").trim();

  const result = await createAgreementDraftFromRegistration({
    companyId,
    rid: authCtx.rid,
    scope: {
      user_id: authCtx.scope.userId,
      email: authCtx.scope.email,
      role: authCtx.scope.role,
    },
  });

  if (result.ok === false) {
    return jsonErr(authCtx.rid, result.message, result.status, result.code);
  }

  return jsonOk(
    authCtx.rid,
    {
      agreementId: result.agreementId,
      status: result.status,
      message: "Avtaleutkast opprettet (Venter). Firmastatus er uendret.",
      audit_ok: result.audit_ok,
    },
    200
  );
}
