export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { checkAiRateLimit, AI_RATE_LIMIT_SCOPE } from "@/lib/ai/rateLimit";
import { runExpansionEngine } from "@/lib/global/runExpansion";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

const EXPAND_RL = { windowSeconds: 3600, max: 24 };

/**
 * POST: rangerer ekspansjonskandidater, bygger pilot-utkast (maks 5 poster), måler ytelse — ingen auto-publisering.
 */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("global_expand");

  const identity =
    (typeof gate.ctx.scope?.email === "string" && gate.ctx.scope.email.trim()) ||
    (typeof gate.ctx.scope?.userId === "string" && gate.ctx.scope.userId.trim()) ||
    "unknown";
  const rl = checkAiRateLimit(identity, `${AI_RATE_LIMIT_SCOPE}:global_expand`, EXPAND_RL);
  if (!rl.allowed) {
    return jsonErr(rid, "Rate limit for ekspansjonsanalyse.", 429, "RATE_LIMIT", {
      retryAfterSeconds: rl.retryAfterSeconds,
    });
  }

  try {
    const result = await runExpansionEngine(rid);
    return jsonOk(rid, result, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, msg, 500, "GLOBAL_EXPAND_FAILED");
  }
  });
}
