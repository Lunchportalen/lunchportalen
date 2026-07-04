export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { loadSuperadminMenuProfileProviderDetail } from "@/lib/server/superadmin/loadSuperadminMenuProfileOverview";

type RouteParams = { params: Promise<{ providerId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const s = await scopeOr401(req);
  if (s.ok === false) return denyResponse(s);
  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const { providerId } = await params;
  const detail = await loadSuperadminMenuProfileProviderDetail(providerId);
  if (!detail) {
    return jsonErr(ctx.rid, "Leverandør ikke funnet.", 404, "NOT_FOUND");
  }

  return jsonOk(ctx.rid, detail, 200);
}
