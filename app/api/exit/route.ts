export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { auditLog } from "@/lib/core/audit";
import { withTimeout } from "@/lib/core/timeout";
import { getExitSnapshot } from "@/lib/exit/valuation";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { opsLog } from "@/lib/ops/log";

function isTimeoutErr(e: unknown): boolean {
  return e instanceof Error && e.message === "TIMEOUT";
}

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.exit.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const snapshot = await withTimeout(getExitSnapshot(), 15_000);
    opsLog("api_exit_GET", {
      rid: gate.ctx.rid,
      revenue: snapshot.kpi.revenue,
      valuation: snapshot.valuation.value,
    });
    await auditLog({
      action: "exit_snapshot_view",
      entity: "exit",
      metadata: { rid: gate.ctx.rid, arr: snapshot.kpi.arr },
    });
    return jsonOk(gate.ctx.rid, snapshot, 200);
  } catch (e) {
    if (isTimeoutErr(e)) {
      return jsonErr(gate.ctx.rid, "Exit-metrics tok for lang tid (timeout).", 504, "EXIT_TIMEOUT", e);
    }
    return jsonErr(gate.ctx.rid, "Kunne ikke hente exit-metrics.", 500, "EXIT_SNAPSHOT_FAILED", e);
  }
}
