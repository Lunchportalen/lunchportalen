export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { structuredLog } from "@/lib/core/structuredLog";
import { traceRequest } from "@/lib/core/requestTrace";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { recordLatency } from "@/lib/observability/latency";
import { endTrace, startTrace } from "@/lib/observability/trace";
import { trackRequest } from "@/lib/sre/metrics";

/** Enkel «UP»-ping (tillegg til dyp /api/health). Blokkerer ikke brukerflyt. */
export async function GET(): Promise<Response> {
  const rid = makeRid("sre_uptime");
  const trace = startTrace("api_sre_uptime", rid);
  try {
    traceRequest(rid, "/api/sre/uptime");
    structuredLog({ type: "request_start", source: "api", rid, payload: { route: "/api/sre/uptime" } });
    trackRequest();
    return jsonOk(rid, { status: "UP" as const, ts: Date.now() }, 200);
  } catch (e) {
    return jsonErr(rid, "SRE uptime ping feilet.", 500, "SRE_UPTIME_FAILED", e);
  } finally {
    const duration = endTrace(trace);
    recordLatency("/api/sre/uptime", duration);
  }
}
