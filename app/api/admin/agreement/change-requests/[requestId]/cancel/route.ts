// app/api/admin/agreement/change-requests/[requestId]/cancel/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";
import type { NextRequest } from "next/server";

import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";
import { cancelAgreementChangeRequest } from "@/lib/agreements/changeRequestService";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

type Ctx = { params: Promise<{ requestId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;

  const denyRole = requireRoleOr403(gate.ctx, "admin.agreement.write", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(gate.ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(gate.ctx.scope.companyId);
  if (!companyId) {
    return jsonErr(gate.ctx.rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");
  }

  const { requestId } = await ctx.params;
  const result = await cancelAgreementChangeRequest({
    rid: gate.ctx.rid,
    requestId,
    companyId,
    actorUserId: safeStr(gate.ctx.scope.userId) || null,
  });

  if (result.ok === false) {
    return jsonErr(gate.ctx.rid, result.message, result.status, result.code, result.detail);
  }

  return jsonOk(gate.ctx.rid, { request: result.data }, 200);
}
