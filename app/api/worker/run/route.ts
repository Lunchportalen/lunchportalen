export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { structuredLog } from "@/lib/core/structuredLog";
import { traceRequest } from "@/lib/core/requestTrace";
import { startDistributedSyncLoopOnce } from "@/lib/distributed/sync";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { getJobs } from "@/lib/queue/jobs";
import { runWorker } from "@/lib/queue/worker";
import { trackRequest } from "@/lib/sre/metrics";

startDistributedSyncLoopOnce();

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.worker.run.GET", ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid;
  traceRequest(rid, "/api/worker/run");
  structuredLog({ type: "request_start", source: "api", rid, payload: { route: "/api/worker/run" } });
  trackRequest();

  try {
    const summary = await runWorker(rid);
    return jsonOk(
      rid,
      {
        summary,
        jobs: getJobs(),
      },
      200,
    );
  } catch (e) {
    return jsonErr(rid, "Worker-kjøring feilet.", 500, "WORKER_RUN_FAILED", e);
  }
}
