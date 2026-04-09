export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { simulateLoad } from "@/lib/chaos/load";
import { structuredLog } from "@/lib/core/structuredLog";
import { traceRequest } from "@/lib/core/requestTrace";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { trackRequest } from "@/lib/sre/metrics";

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.chaos.load.GET", ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid;
  traceRequest(rid, "/api/chaos/load");
  structuredLog({ type: "request_start", source: "api", rid, payload: { route: "/api/chaos/load" } });
  trackRequest();

  const origin = req.nextUrl.origin;
  const nRaw = req.nextUrl.searchParams.get("n");
  const n = nRaw != null && nRaw.length ? Number.parseInt(nRaw, 10) : 200;

  try {
    const result = await simulateLoad(n, origin, rid);
    return jsonOk(rid, { load: result, origin }, 200);
  } catch (e) {
    return jsonErr(rid, "Lastsimulering feilet.", 500, "CHAOS_LOAD_FAILED", e);
  }
}
