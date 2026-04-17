export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { loadCompanyRegistrationDetail } from "@/lib/server/superadmin/loadCompanyRegistrationsInbox";

type Ctx = { params: { companyId: string } | Promise<{ companyId: string }> };

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

/**
 * GET /api/superadmin/company-registrations/:companyId
 * Én rad company_registrations (PK = company_id) + companies.
 */
export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const authCtx = s.ctx;
  const deny = requireRoleOr403(authCtx, "api.superadmin.company_registrations.detail.GET", ["superadmin"]);
  if (deny) return deny;

  const params = await Promise.resolve(ctx.params as { companyId?: string });
  const companyId = String(params?.companyId ?? "").trim();

  const bundle = await loadCompanyRegistrationDetail(companyId);
  if (bundle.ok === true) {
    return jsonOk(
      authCtx.rid,
      {
        item: bundle.item,
        source: { primary: "company_registrations", company: "companies" },
      },
      200
    );
  }

  if ("notFound" in bundle && bundle.notFound) {
    return jsonErr(authCtx.rid, "Fant ikke registrering.", 404, "REGISTRATION_NOT_FOUND");
  }

  const err = bundle as { ok: false; message: string; code?: string };
  return jsonErr(authCtx.rid, err.message, 500, "REGISTRATION_READ_FAILED", { code: err.code });
}
