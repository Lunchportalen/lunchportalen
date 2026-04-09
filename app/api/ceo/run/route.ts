export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { loadCeoEngineInputs } from "@/lib/ceo/loadEngineInputs";
import { runCeoEngine } from "@/lib/ceo/run";
import { verifyTable } from "@/lib/db/verifyTable";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

const LOG_CAP = 32;

function shrink<T>(arr: T[] | undefined, max: number): T[] {
  return Array.isArray(arr) ? arr.slice(0, max) : [];
}

/** POST: kjør deterministisk CEO-motor (samme datakilder som revenue/social/pipeline — ingen intern HTTP). */
export async function POST(_req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(_req, "POST", async () => {
  const rid = makeRid("ceo_run");
  try {
    const gate = await scopeOr401(_req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    const input = await loadCeoEngineInputs();
    const result = runCeoEngine(input);

    try {
      const admin = supabaseAdmin();
      const tableOk = await verifyTable(admin, "ai_activity_log", "ceo_run");
      if (tableOk) {
        const row = buildAiActivityLogRow({
          action: "agent_run",
          actor_user_id: gate.ctx.scope?.email ?? null,
          metadata: {
            ceo_decision: true,
            insights: shrink(result.insights, LOG_CAP),
            opportunities: shrink(result.opportunities, LOG_CAP),
            actions: shrink(result.actions, LOG_CAP),
            rid,
            source: "ceo_engine",
          },
          tool: "ceo_engine",
        });
        const { error } = await admin.from("ai_activity_log").insert({
          ...row,
          rid,
          status: "success",
        } as Record<string, unknown>);
        if (error) {
          console.error("[CEO_RUN_LOG_INSERT]", error.message);
        }
      }
    } catch (e) {
      console.error("[CEO_RUN_LOG]", e);
    }

    return jsonOk(rid, result, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, message, 500, "CEO_RUN_UNHANDLED");
  }
  });
}
