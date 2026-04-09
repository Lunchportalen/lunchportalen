export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { guardConcurrency } from "@/lib/infra/concurrency";
import { isShuttingDown } from "@/lib/infra/shutdown";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function isPodOverload(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "POD_OVERLOAD";
}

/**
 * Kubernetes liveness — prosess lever (ingen dyp DB-sjekk).
 */
export async function GET(): Promise<Response> {
  const rid = makeRid("k8s_live");
  try {
    return await guardConcurrency(async () => {
      if (isShuttingDown()) {
        return jsonErr(rid, "Pod stenger.", 503, "SHUTTING_DOWN");
      }
      return jsonOk(rid, { status: "LIVE" as const, ts: Date.now() }, 200);
    });
  } catch (e) {
    if (isPodOverload(e)) {
      return jsonErr(rid, "Pod overbelastet.", 503, "POD_OVERLOAD", e);
    }
    return jsonErr(rid, "Liveness feilet.", 500, "LIVE_PROBE_FAILED", e);
  }
}
