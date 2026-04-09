export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { collectGlobalMetrics } from "@/lib/ops/global";

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.ops.global.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const metrics = collectGlobalMetrics();
    return jsonOk(gate.ctx.rid, { metrics }, 200);
  } catch (e) {
    return jsonErr(gate.ctx.rid, "Kunne ikke samle globale metrics.", 500, "GLOBAL_OPS_FAILED", e);
  }
}
