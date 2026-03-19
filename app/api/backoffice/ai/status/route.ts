import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { getAiProviderConfig } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  try {
    const config = getAiProviderConfig();
    return jsonOk(
      ctx.rid,
      {
        enabled: config.enabled,
        provider: config.provider || null,
        model: config.model,
        errorCode: config.errorCode ?? null,
      },
      200
    );
  } catch {
    return jsonErr(ctx.rid, "Kunne ikke hente AI-status.", 500, "AI_STATUS_FAILED");
  }
}