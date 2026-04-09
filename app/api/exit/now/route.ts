export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { buildExitStrategy } from "@/lib/exit/strategy";
import { getKPIs } from "@/lib/exit/kpi";
import { matchBuyers } from "@/lib/exit/match";
import { structuredLog } from "@/lib/core/structuredLog";
import { traceRequest } from "@/lib/core/requestTrace";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { trackRequest } from "@/lib/sre/metrics";

export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, "api.exit.now.GET", ["superadmin"]);
    if (deny) return deny;

    const rid = gate.ctx.rid;
    traceRequest(rid, "/api/exit/now");
    structuredLog({ type: "request_start", source: "api", rid, payload: { route: "/api/exit/now" } });
    trackRequest();

    try {
      const metrics = await getKPIs();
      const strategy = await buildExitStrategy(metrics);
      const buyers = matchBuyers();

      console.log("[LIVE_SYSTEM]", { rid, route: "exit_now", metrics, buyers: buyers.length });

      return jsonOk(rid, { strategy, buyers, metrics }, 200);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Exit-strategi feilet.";
      return jsonErr(rid, message, 500, "EXIT_NOW_FAIL", e);
    }
  });
}
