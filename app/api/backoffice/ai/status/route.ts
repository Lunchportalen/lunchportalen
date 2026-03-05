import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { isAIEnabled } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;
  const enabled = isAIEnabled();
  return jsonOk(ctx.rid, {
    ok: true,
    rid: ctx.rid,
    enabled,
    provider: process.env.AI_PROVIDER ?? null,
    model: process.env.AI_MODEL ?? null,
  }, 200);
}