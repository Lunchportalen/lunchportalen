// app/api/superadmin/system/health/route.ts
// Unified system health: database, cron, outbox, AI jobs, migrations, environment.
// Returns structured JSON; no sensitive data.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { getSystemHealth } from "@/lib/system/systemHealthAggregator";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const deny = requireRoleOr403(s.ctx, "api.superadmin.system.health.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const admin = supabaseAdmin();
    const result = await getSystemHealth(admin as any);

    return jsonOk(s.ctx.rid, result, 200);
  } catch (e: any) {
    opsLog("superadmin.system.health.error", {
      rid: s?.ctx?.rid ?? null,
      message: String(e?.message ?? e),
    });
    return jsonErr(s.ctx.rid, "Kunne ikke hente systemhelse.", 500, {
      code: "SYSTEM_HEALTH_FAILED",
      detail: { message: String(e?.message ?? e) },
    });
  }
}
