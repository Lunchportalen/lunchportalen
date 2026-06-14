// app/api/superadmin/agreement-change-requests/[requestId]/approve/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";
import type { NextRequest } from "next/server";

import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { approveAgreementChangeRequest } from "@/lib/agreements/changeRequestService";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

type Ctx = { params: Promise<{ requestId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;

  const denyRole = requireRoleOr403(gate.ctx, "superadmin.agreement_change.approve", ["superadmin"]);
  if (denyRole) return denyRole;

  const { requestId } = await ctx.params;
  const result = await approveAgreementChangeRequest({
    rid: gate.ctx.rid,
    requestId,
    actorUserId: safeStr(gate.ctx.scope.userId) || null,
    scope: {
      user_id: safeStr(gate.ctx.scope.userId) || null,
      email: safeStr(gate.ctx.scope.email) || null,
      role: safeStr(gate.ctx.scope.role) || null,
    },
  });

  if (result.ok === false) {
    return jsonErr(gate.ctx.rid, result.message, result.status, result.code, result.detail);
  }

  return jsonOk(gate.ctx.rid, { request: result.data }, 200);
}
