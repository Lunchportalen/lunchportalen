export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { shouldFail } from "@/lib/chaos/engine";
import { structuredLog } from "@/lib/core/structuredLog";
import { traceRequest } from "@/lib/core/requestTrace";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { trackRequest } from "@/lib/sre/metrics";

/**
 * Kontrollert chaos (kun superadmin). Krever CHAOS_MODE=true for injisert feil.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.chaos.test.GET", ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid;
  traceRequest(rid, "/api/chaos/test");
  structuredLog({
    type: "request_start",
    source: "api",
    rid,
    payload: { route: "/api/chaos/test" },
  });
  trackRequest();

  const chaosOn = String(process.env.CHAOS_MODE ?? "").trim().toLowerCase() === "true";
  if (!chaosOn) {
    return jsonOk(
      rid,
      { chaos: false, message: "CHAOS_MODE er av — ingen simulering.", injected: false },
      200,
    );
  }

  if (shouldFail(1, rid)) {
    return jsonErr(rid, "Simulert feil (chaos).", 503, "CHAOS_FAILURE");
  }

  return jsonOk(rid, { chaos: true, injected: false }, 200);
}
