export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
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
 * Canonical: lp_agreement_create_pending (samme som POST /api/superadmin/agreements), trigget fra registrering.
 */
export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  void req;
  void ctx;
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const authCtx = s.ctx;
  const deny = requireRoleOr403(authCtx, "superadmin.agreements.create", ["superadmin"]);
  if (deny) return deny;

  return jsonErr(
    authCtx.rid,
    "Opprettelse av agreement-utkast fra registrering er ikke lenger tillatt. Bruk approve/reject-knappene på registreringen direkte.",
    410,
    "FLOW_DEPRECATED"
  );
}
