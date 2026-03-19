// app/api/superadmin/system/status/route.ts
// Single source of truth for operational status: health, SLOs, SLIs, alerts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, denyResponse } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOperationalStatus } from "@/lib/observability/statusAggregator";
import { opsLog } from "@/lib/ops/log";

export async function GET(req: NextRequest): Promise<Response> {
  const s = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const deny = requireRoleOr403(s.ctx, "api.superadmin.system.status.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const admin = supabaseAdmin();
    const status = await getOperationalStatus(admin as any);

    return jsonOk(s.ctx.rid, status, 200);
  } catch (e: any) {
    opsLog("superadmin.system.status.error", {
      rid: s?.ctx?.rid ?? null,
      message: String(e?.message ?? e),
    });
    return jsonErr(s.ctx.rid, "Kunne ikke hente operativ status.", 500, {
      code: "STATUS_AGGREGATION_FAILED",
      detail: { message: String(e?.message ?? e) },
    });
  }
}
