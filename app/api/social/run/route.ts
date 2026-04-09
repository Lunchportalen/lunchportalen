export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runAutonomousCycle } from "@/lib/social/automationEngine";
import { defaultSocialLocation } from "@/lib/social/location";
import { SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS } from "@/lib/social/superadminEngineSeed";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/** POST: manuell eller cron — superadmin, samme motor som UI (ingen auto-publisering). */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const ctx = gate.ctx;
    const deny = requireRoleOr403(ctx, ["superadmin"]);
    if (deny) return deny;

    const rid = ctx.rid || makeRid("social_run");
    const actor = ctx.scope.userId;
    if (!actor) {
      return jsonErr(rid, "Mangler bruker-id i sesjon.", 403, "FORBIDDEN");
    }

    const body = await readJson(req);
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const postsJson = typeof o.postsJson === "string" ? o.postsJson : "[]";
    const paused = o.paused === true;

    try {
      const result = await runAutonomousCycle({
        postsJson,
        products: SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS,
        location: defaultSocialLocation,
        paused,
        actorUserId: actor,
      });
      return jsonOk(rid, result, 200);
    } catch (e) {
      const message = e instanceof Error ? e.message : "SoMe-autonomi-syklus feilet.";
      return jsonErr(rid, message, 500, "SOCIAL_AUTONOMY_RUN_FAILED");
    }
  });
}
