export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { loadSuperadminMenuProfileOverview } from "@/lib/server/superadmin/loadSuperadminMenuProfileOverview";

export async function GET(req: NextRequest) {
  const s = await scopeOr401(req);
  if (s.ok === false) return denyResponse(s);
  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  try {
    const data = await loadSuperadminMenuProfileOverview();
    return jsonOk(ctx.rid, data, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke laste menyprofiloversikt.";
    return jsonErr(ctx.rid, message, 500, "DB_ERROR");
  }
}
