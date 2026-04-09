import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { runPendingJobs } from "@/lib/ai/jobs/runner";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApiAiEntrypoint(request, "POST", async () => {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const { ran, completed, failed } = await runPendingJobs();
  return jsonOk(ctx.rid, { ok: true, ran, completed, failed }, 200);
  });
}