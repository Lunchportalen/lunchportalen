export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import "@/lib/eventBus/handlers";

import { publish } from "@/lib/eventBus/bus";
import type { BusEvent } from "@/lib/eventBus/bus";
import { structuredLog } from "@/lib/core/structuredLog";
import { traceRequest } from "@/lib/core/requestTrace";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { guardConcurrency } from "@/lib/infra/concurrency";
import { isShuttingDown } from "@/lib/infra/shutdown";
import { trackRequest } from "@/lib/sre/metrics";

function isPodOverload(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "POD_OVERLOAD";
}

export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.events.publish.POST", ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid;
  traceRequest(rid, "/api/events/publish");
  structuredLog({ type: "request_start", source: "api", rid, payload: { route: "/api/events/publish" } });
  trackRequest();

  try {
    return await guardConcurrency(async () => {
      if (isShuttingDown()) {
        return jsonErr(rid, "Pod stenger.", 503, "SHUTTING_DOWN");
      }

      const body = await readJson(req);
      const type = typeof body?.type === "string" ? body.type.trim() : "";
      if (!type) {
        return jsonErr(rid, "Feltet type er påkrevd.", 422, "VALIDATION", { field: "type" });
      }

      const event: BusEvent = { type, payload: body?.payload };
      publish(event);

      return jsonOk(rid, { published: true, type }, 200);
    });
  } catch (e) {
    if (isPodOverload(e)) {
      return jsonErr(rid, "Pod overbelastet.", 503, "POD_OVERLOAD", e);
    }
    return jsonErr(rid, "Publisering feilet.", 500, "EVENT_PUBLISH_FAILED", e);
  }
}
