export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { structuredLog } from "@/lib/core/structuredLog";
import { traceRequest } from "@/lib/core/requestTrace";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { enqueue, getJobs, type Job } from "@/lib/queue/jobs";
import { saveQueueSnapshot } from "@/lib/queue/persistent";
import { trackRequest } from "@/lib/sre/metrics";

export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.queue.add.POST", ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid;
  traceRequest(rid, "/api/queue/add");
  structuredLog({ type: "request_start", source: "api", rid, payload: { route: "/api/queue/add" } });
  trackRequest();

  const body = await readJson(req);
  const type = typeof body?.type === "string" ? body.type.trim() : "";
  if (!type) {
    return jsonErr(rid, "Feltet type er påkrevd.", 422, "VALIDATION", { field: "type" });
  }

  const job: Job = {
    id: crypto.randomUUID(),
    type,
    payload: body?.payload,
    status: "queued",
    createdAt: Date.now(),
  };

  const enq = enqueue(job);
  if (!enq.ok) {
    return jsonErr(rid, "Jobbkø er full (maks nådd).", 503, "QUEUE_FULL");
  }

  saveQueueSnapshot(getJobs());

  return jsonOk(rid, { job }, 200);
}
