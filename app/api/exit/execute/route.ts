export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getBuyers } from "@/lib/exit/buyers";
import { prepareExit } from "@/lib/exit/prepare";
import { structuredLog } from "@/lib/core/structuredLog";
import { traceRequest } from "@/lib/core/requestTrace";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { trackRequest } from "@/lib/sre/metrics";

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.exit.execute.GET", ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid;
  traceRequest(rid, "/api/exit/execute");
  structuredLog({ type: "request_start", source: "api", rid, payload: { route: "/api/exit/execute" } });
  trackRequest();

  try {
    const prep = await prepareExit();
    const buyers = getBuyers();
    return jsonOk(rid, { prep, buyers }, 200);
  } catch (e) {
    return jsonErr(rid, "Exit-forberedelse feilet.", 500, "EXIT_PREP_FAILED", e);
  }
}
