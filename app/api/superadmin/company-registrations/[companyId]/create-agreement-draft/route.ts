export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import {
  AGREEMENT_DRAFT_FLOW_DISABLED_CODE,
  AGREEMENT_DRAFT_FLOW_DISABLED_MESSAGE,
} from "@/lib/server/superadmin/agreementDraftFlowDisabled";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

type Ctx = { params: { companyId: string } | Promise<{ companyId: string }> };

void jsonOk;

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

/**
 * POST /api/superadmin/company-registrations/:companyId/create-agreement-draft
 * Fail-closed: manuell avtaleutkast-flyt er deaktivert (lp_agreement_create_pending finnes ikke i prod).
 */
export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  void req;
  void ctx;
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const authCtx = s.ctx;
  const deny = requireRoleOr403(authCtx, "superadmin.agreements.create", ["superadmin"]);
  if (deny) return deny;

  return jsonErr(authCtx.rid, AGREEMENT_DRAFT_FLOW_DISABLED_MESSAGE, 410, AGREEMENT_DRAFT_FLOW_DISABLED_CODE);
}
