export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { collectInvestorMetrics } from "@/lib/investor/metrics";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/**
 * GET: exit-oriented KPI block (superadmin only). Same auth plane as GET /api/superadmin/investor.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("investor_metrics");
  try {
    const data = await collectInvestorMetrics(rid);
    return jsonOk(rid, data, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, msg, 500, "INVESTOR_METRICS_FAILED");
  }
}
