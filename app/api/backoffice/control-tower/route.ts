export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { collectSignals } from "@/lib/ai/signals";
import { withTimeout } from "@/lib/core/timeout";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, "api.backoffice.control-tower.GET", ["superadmin"]);
    if (deny) return deny;

    try {
      const signals = await withTimeout(collectSignals(), 12_000);
      const status = signals.conversionRate > 0.05 ? "GOOD" : "NEEDS_WORK";
      return jsonOk(gate.ctx.rid, { ...signals, status }, 200);
    } catch (e) {
      if (e instanceof Error && e.message === "TIMEOUT") {
        return jsonErr(gate.ctx.rid, "Control Tower-signaler tok for lang tid (timeout).", 504, "CONTROL_TOWER_TIMEOUT", e);
      }
      return jsonErr(gate.ctx.rid, "Kunne ikke hente signaler.", 500, "CONTROL_TOWER_SIGNALS_FAILED", e);
    }
  });
}
