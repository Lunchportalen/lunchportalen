export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runAutonomousBusiness, simulateAutonomousRun } from "@/lib/autonomy/engine";
import { getResolvedAutonomyPolicy } from "@/lib/autonomy/effectivePolicy";
import { makeDemoAutonomyContext } from "@/lib/autonomy/demoContext";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { readJson } from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

/** POST: kjør autonom simulering eller live (live krever policy.enabled). */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, "api.superadmin.autonomy.run.POST", ["superadmin"]);
    if (deny) return deny;

    const rid = gate.ctx.rid || makeRid("autonomy_run");
    const body = (await readJson(req)) as { mode?: string } | null;
    const mode = body?.mode === "live" ? "live" : "dry_run";

    try {
      const policy = await getResolvedAutonomyPolicy();
      if (mode === "live" && !policy.enabled) {
        return jsonErr(
          rid,
          "Live-kjøring krever at autonom master er på (og Root ved første aktivering).",
          400,
          "AUTONOMY_LIVE_DISABLED",
        );
      }

      const ctx = makeDemoAutonomyContext();
      const result =
        mode === "dry_run"
          ? await simulateAutonomousRun(ctx, policy, { actorUserId: gate.ctx.scope?.userId ?? null })
          : await runAutonomousBusiness(ctx, policy, "live", { actorUserId: gate.ctx.scope?.userId ?? null });

      return jsonOk(rid, { mode, result, policyCapsNote: "Tak er kodet i lib/autonomy/policy.ts" }, 200);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Autonom kjøring feilet.";
      return jsonErr(rid, message, 500, "AUTONOMY_RUN_FAILED");
    }
  });
}
