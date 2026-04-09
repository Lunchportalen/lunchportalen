export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runCeoCycle } from "@/lib/ai/ceo/runner";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/** POST: run one controlled CEO cycle as the authenticated superadmin (respects 1h limit unless force). */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = ctx.rid || makeRid("ceo_run");
  const body = await readJson(req);
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const force = o.force === true;

  const actor = ctx.scope.userId;
  if (!actor) {
    return jsonErr(rid, "Mangler bruker-id i sesjon.", 403, "FORBIDDEN");
  }

  try {
    const result = await runCeoCycle({
      rid: makeRid("ceo_cycle"),
      actor_user_id: actor,
      company_id: ctx.scope.companyId,
      role: ctx.scope.role ?? "superadmin",
      force,
    });
    return jsonOk(rid, result, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "CEO-syklus feilet.";
    return jsonErr(rid, message, 500, "CEO_RUN_FAILED");
  }
  });
}
