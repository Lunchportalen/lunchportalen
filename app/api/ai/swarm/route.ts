export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runConsensus } from "@/lib/ai/consensus";
import { enforceAIPolicy } from "@/lib/ai/governor";
import { runSwarm } from "@/lib/ai/swarm";
import { structuredLog } from "@/lib/core/structuredLog";
import { traceRequest } from "@/lib/core/requestTrace";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { getCachedSettings } from "@/lib/settings/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { trackRequest } from "@/lib/sre/metrics";

function policyMessage(e: unknown): string {
  if (typeof e === "object" && e !== null && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return "AI-policy ikke oppfylt.";
}

/**
 * POST — superadmin, swarm (deterministisk, ingen auto-LLM-kall).
 */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, "api.ai.swarm.POST", ["superadmin"]);
    if (deny) return deny;

    const rid = gate.ctx.rid;
    traceRequest(rid, "/api/ai/swarm");
    structuredLog({ type: "request_start", source: "api", rid, payload: { route: "/api/ai/swarm" } });
    trackRequest();

    try {
      const sb = await supabaseServer();
      const settings = await getCachedSettings(sb);
      enforceAIPolicy(settings, { type: "swarm" });
    } catch (e) {
      return jsonErr(rid, policyMessage(e), 503, "AI_DISABLED", e);
    }

    const body = await readJson(req);

    try {
      const results = await runSwarm(body);
      const decision = await runConsensus(results);
      if (!decision) {
        return jsonErr(rid, "Ingen konsensusbeslutning (tomt stemmegrunnlag).", 422, "NO_DECISION");
      }
      console.log("[GLOBAL_SYSTEM]", { decision, ts: Date.now(), rid });
      return jsonOk(rid, { results, decision }, 200);
    } catch (e) {
      return jsonErr(rid, "Swarm-kjøring feilet.", 500, "SWARM_FAILED", e);
    }
  });
}
