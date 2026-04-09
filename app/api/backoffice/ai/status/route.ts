import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { getAiProviderConfig } from "@/lib/ai/runner";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { getPosUiSnapshotForBackoffice } from "@/lib/system/controlPlaneMetrics";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  return withApiAiEntrypoint(request, "GET", async () => {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  try {
    const config = getAiProviderConfig();
    const runtime = getCmsRuntimeStatus();
    return jsonOk(
      ctx.rid,
      {
        enabled: config.enabled,
        provider: config.provider || null,
        model: config.model,
        errorCode: config.errorCode ?? null,
        runtime,
        pos: getPosUiSnapshotForBackoffice(),
      },
      200
    );
  } catch {
    return jsonErr(ctx.rid, "Kunne ikke hente AI-status.", 500, "AI_STATUS_FAILED");
  }
  });
}