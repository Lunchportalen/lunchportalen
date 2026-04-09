export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { checkAiRateLimit, AI_RATE_LIMIT_SCOPE } from "@/lib/ai/rateLimit";
import { runGlobalSystem } from "@/lib/global/run";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

const GLOBAL_RUN_RL = { windowSeconds: 3600, max: 12 };

/** POST: kjør global orkestrering per aktivert marked (superadmin). */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("global_run");

  const identity =
    (typeof gate.ctx.scope?.email === "string" && gate.ctx.scope.email.trim()) ||
    (typeof gate.ctx.scope?.userId === "string" && gate.ctx.scope.userId.trim()) ||
    "unknown";
  const rl = checkAiRateLimit(identity, `${AI_RATE_LIMIT_SCOPE}:global_run`, GLOBAL_RUN_RL);
  if (!rl.allowed) {
    return jsonErr(rid, "Rate limit for global kjøring.", 429, "RATE_LIMIT", {
      retryAfterSeconds: rl.retryAfterSeconds,
    });
  }

  const body = await readJson(req);
  const marketOverrides =
    body.marketOverrides && typeof body.marketOverrides === "object" && !Array.isArray(body.marketOverrides)
      ? (body.marketOverrides as Record<string, boolean>)
      : undefined;

  try {
    const actorEmail = gate.ctx.scope?.email ?? null;
    const result = await runGlobalSystem({
      marketOverrides,
      actorEmail,
      rid,
    });

    return jsonOk(
      rid,
      {
        rid: result.rid,
        markets: result.markets,
        errors: result.errors,
      },
      200,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, "Global kjøring feilet.", 500, "GLOBAL_RUN_FAILED", { detail: msg });
  }
  });
}
