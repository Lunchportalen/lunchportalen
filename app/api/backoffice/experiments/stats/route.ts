import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getExperimentStats } from "@/lib/ai/experiments/analytics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const experimentId = request.nextUrl.searchParams.get("experimentId") ?? "";
  if (!experimentId.trim()) return jsonErr(ctx.rid, "Mangler experimentId.", 400, "BAD_REQUEST");

  const supabase = supabaseAdmin();
  const stats = await getExperimentStats(supabase, experimentId.trim());
  return jsonOk(ctx.rid, { ok: true, data: stats }, 200);
}