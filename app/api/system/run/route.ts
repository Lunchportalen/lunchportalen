export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { structuredLog } from "@/lib/core/structuredLog";
import { traceRequest } from "@/lib/core/requestTrace";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { runSystem } from "@/lib/system/orchestrator";
import { supabaseServer } from "@/lib/supabase/server";
import { trackRequest } from "@/lib/sre/metrics";

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.system.run.GET", ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid;
  traceRequest(rid, "/api/system/run");
  structuredLog({ type: "request_start", source: "api", rid, payload: { route: "/api/system/run" } });
  trackRequest();

  try {
    const sb = await supabaseServer();
    const result = await runSystem(sb);

    if (result.ok === false) {
      return jsonErr(rid, "Systeminnstillinger er ikke tilgjengelige.", 503, result.error);
    }

    return jsonOk(
      rid,
      {
        autonomy: result.autonomy,
        sales: result.sales,
      },
      200,
    );
  } catch (e) {
    console.error("[SYSTEM_RUN_FAIL]", e);
    return jsonErr(rid, "Systemkjøring feilet.", 500, "SYSTEM_FAIL", e);
  }
}
