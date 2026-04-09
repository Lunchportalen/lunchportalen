export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runExit } from "@/lib/exit/execute";
import { getKPIs } from "@/lib/exit/kpi";
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
    const deny = requireRoleOr403(gate.ctx, "api.exit.sell.GET", ["superadmin"]);
    if (deny) return deny;

    const rid = gate.ctx.rid;
    traceRequest(rid, "/api/exit/sell");
    structuredLog({ type: "request_start", source: "api", rid, payload: { route: "/api/exit/sell" } });
    trackRequest();

    try {
      const metrics = await getKPIs();
      const result = await runExit(metrics);

      console.log("[EXECUTION]", { rid, stage: "exit_sell", status: result.status });

      return jsonOk(rid, result, 200);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Exit-salg feilet.";
      return jsonErr(rid, message, 500, "EXIT_SELL_FAIL", e);
    }
  });
}
