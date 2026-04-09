export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { auditLog } from "@/lib/core/audit";
import { runExecutionCycle } from "@/lib/execution/run";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { opsLog } from "@/lib/ops/log";

/**
 * POST: kjør godkjente handlinger (eksplisitt operatørhandling — ikke GET).
 */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.execution.run.POST", ["superadmin"]);
  if (deny) return deny;

  try {
    const result = await runExecutionCycle();
    opsLog("api_execution_run_POST", {
      rid: gate.ctx.rid,
      processed: result.processed,
      autoMode: result.autoMode,
    });
    await auditLog({
      action: "execution_cycle_ran",
      entity: "execution",
      metadata: { rid: gate.ctx.rid, processed: result.processed, autoMode: result.autoMode },
    });
    return jsonOk(gate.ctx.rid, result, 200);
  } catch (e) {
    return jsonErr(gate.ctx.rid, "Kunne ikke kjøre pipeline.", 500, "EXECUTION_RUN_FAILED", e);
  }
}
