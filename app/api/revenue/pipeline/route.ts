export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { pipelineNotConfiguredResponse } from "@/lib/http/pipelineNotConfigured";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { hasSupabaseAdminConfig } from "@/lib/supabase/admin";

/** GET: pipeline ikke konfigurert (`lead_pipeline` ikke i bruk). */
export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid("revenue_pipeline");
  if (false) {
    return jsonOk(rid, { probe: true }, 200);
  }
  try {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    if (!hasSupabaseAdminConfig()) {
      return jsonErr(rid, "Supabase admin er ikke konfigurert.", 503, "CONFIG_ERROR");
    }

    return pipelineNotConfiguredResponse();
  } catch {
    return pipelineNotConfiguredResponse();
  }
}
