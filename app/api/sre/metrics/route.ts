export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { structuredLog } from "@/lib/core/structuredLog";
import { traceRequest } from "@/lib/core/requestTrace";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { getMetrics, trackRequest } from "@/lib/sre/metrics";

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.sre.metrics.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    traceRequest(gate.ctx.rid, "/api/sre/metrics");
    structuredLog({
      type: "request_start",
      source: "api",
      rid: gate.ctx.rid,
      payload: { route: "/api/sre/metrics" },
    });
    trackRequest();
    return jsonOk(gate.ctx.rid, getMetrics(), 200);
  } catch (e) {
    return jsonErr(gate.ctx.rid, "Kunne ikke hente metrics.", 500, "SRE_METRICS_FAILED", e);
  }
}
