export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { loadCompanyRegistrationsInbox } from "@/lib/server/superadmin/loadCompanyRegistrationsInbox";

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

/**
 * GET /api/superadmin/company-registrations
 * Lesing av operative rader i company_registrations (+ firmastatus fra companies).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.company_registrations.GET", ["superadmin"]);
  if (deny) return deny;

  const bundle = await loadCompanyRegistrationsInbox();
  if (bundle.ok === false) {
    return jsonErr(ctx.rid, bundle.message, 500, "REGISTRATIONS_READ_FAILED", { code: bundle.code });
  }

  return jsonOk(
    ctx.rid,
    {
      items: bundle.items,
      source: { primary: "company_registrations", company: "companies", agreements_ledger: "agreements" },
    },
    200
  );
}
