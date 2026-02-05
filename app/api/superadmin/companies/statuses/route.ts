// app/api/superadmin/companies/statuses/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

// Fasit i systemet (companies.status)
const STATUSES = ["pending", "active", "paused", "closed"] as const;
type CompanyStatus = (typeof STATUSES)[number];

export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.companies.statuses.GET", ["superadmin"]);
  if (deny) return deny;

  const items = STATUSES.map((value) => ({
    value,
    label: value.toUpperCase(), // UI-vennlig
  })) satisfies Array<{ value: CompanyStatus; label: string }>;

  return jsonOk(ctx.rid, {
      ok: true,
      rid: ctx.rid,
      statuses: items,
    }, 200);
}

