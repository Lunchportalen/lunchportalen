export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getOpsSignals } from "@/lib/ops/signals";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.ops.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const s = await getOpsSignals();
    const events = s.auditLogRows + s.auditEventRows;
    return jsonOk(
      gate.ctx.rid,
      {
        status: events > 0 ? "ACTIVE" : "IDLE",
        events,
        auditLogs: s.auditLogRows,
        auditEvents: s.auditEventRows,
      },
      200,
    );
  } catch (e) {
    return jsonErr(gate.ctx.rid, "Kunne ikke hente ops-signaler.", 500, "OPS_SIGNALS_FAILED", e);
  }
}
