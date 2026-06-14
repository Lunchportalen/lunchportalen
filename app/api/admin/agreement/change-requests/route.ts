// app/api/admin/agreement/change-requests/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";
import type { NextRequest } from "next/server";

import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";
import {
  createPackageByDayChangeRequest,
  listAgreementChangeRequests,
} from "@/lib/agreements/changeRequestService";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;

  const denyRole = requireRoleOr403(ctx, "admin.agreement.read", ["company_admin", "superadmin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(ctx.scope.companyId);
  if (!companyId) {
    return jsonErr(ctx.rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");
  }

  const result = await listAgreementChangeRequests({ rid: ctx.rid, companyId });
  if (result.ok === false) {
    return jsonErr(ctx.rid, result.message, result.status, result.code, result.detail);
  }

  return jsonOk(ctx.rid, { requests: result.data }, 200);
}

type CreateBody = {
  effectiveFrom?: unknown;
  effective_from?: unknown;
  effectiveTo?: unknown;
  effective_to?: unknown;
  requestedChange?: unknown;
  requested_change?: unknown;
  note?: unknown;
};

export async function POST(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;

  const denyRole = requireRoleOr403(ctx, "admin.agreement.write", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(ctx.scope.companyId);
  if (!companyId) {
    return jsonErr(ctx.rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");
  }

  const body = (await readJson(req)) as CreateBody;
  const effectiveFrom = safeStr(body.effectiveFrom ?? body.effective_from);
  const effectiveToRaw = body.effectiveTo ?? body.effective_to;
  const effectiveTo = effectiveToRaw == null || safeStr(effectiveToRaw) === "" ? null : safeStr(effectiveToRaw);
  const requestedChange = body.requestedChange ?? body.requested_change;
  const note = body.note == null ? null : safeStr(body.note);

  const result = await createPackageByDayChangeRequest({
    rid: ctx.rid,
    companyId,
    requestedByUserId: safeStr(ctx.scope.userId) || null,
    requestedByRole: safeStr(ctx.scope.role) || "company_admin",
    effectiveFrom,
    effectiveTo,
    requestedChange,
    note,
  });

  if (result.ok === false) {
    return jsonErr(ctx.rid, result.message, result.status, result.code, result.detail);
  }

  return jsonOk(ctx.rid, { request: result.data }, 201);
}
