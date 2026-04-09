export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getQueue } from "@/lib/execution/queue";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.execution.queue.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    return jsonOk(gate.ctx.rid, { queue: getQueue() }, 200);
  } catch (e) {
    return jsonErr(gate.ctx.rid, "Kunne ikke hente kø.", 500, "EXECUTION_QUEUE_FAILED", e);
  }
}
