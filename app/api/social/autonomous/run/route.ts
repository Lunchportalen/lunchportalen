export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runSocialAutonomyCycleFromDb } from "@/lib/social/autonomousRunner";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/** POST: manuell superadmin-kjøring av autonom SoMe-syklus (ingen localhost, ingen cron-secret). */
export async function POST(req: NextRequest): Promise<Response> {
  const rid = makeRid("social_autonomous_run");
  try {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    const result = await runSocialAutonomyCycleFromDb();
    return jsonOk(rid, result, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, message, 500, "SOCIAL_AUTONOMOUS_RUN_UNHANDLED");
  }
}
