export const runtime = "edge";
export const dynamic = "force-dynamic";

import { denyUnlessEdgeSession } from "@/lib/auth/edgeSession";
import { getClosestRegion } from "@/lib/edge/geo";
import { runGlobal } from "@/lib/edge/globalRun";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/edgeContract";

export async function GET(req: Request): Promise<Response> {
  const denied = denyUnlessEdgeSession(req);
  if (denied) return denied;
  const rid = makeRid("edge_ai");
  if (String(process.env.CHAOS_MODE ?? "").trim().toLowerCase() === "true") {
    console.warn("[CHAOS_ACTIVE]");
  }
  try {
    const hint = await runGlobal(async () => ({ regionHint: getClosestRegion() }));
    return jsonOk(
      rid,
      {
        region: process.env.VERCEL_REGION ?? "global",
        ts: Date.now(),
        hint,
      },
      200,
    );
  } catch (e) {
    return jsonErr(rid, "Edge AI metadata feilet.", 500, "EDGE_AI_FAILED", e);
  }
}
