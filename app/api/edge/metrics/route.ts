export const runtime = "edge";
export const dynamic = "force-dynamic";

import { getClosestRegion } from "@/lib/edge/geo";
import { runAtEdge } from "@/lib/edge/run";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/edgeContract";

export async function GET(): Promise<Response> {
  const rid = makeRid("edge_metrics");
  try {
    const extra = await runAtEdge(async () => ({
      regionHint: getClosestRegion(),
    }));
    return jsonOk(
      rid,
      {
        region: process.env.VERCEL_REGION ?? "global",
        ts: Date.now(),
        hint: extra,
      },
      200,
    );
  } catch (e) {
    return jsonErr(rid, "Edge metrics feilet.", 500, "EDGE_METRICS_FAILED", e);
  }
}
