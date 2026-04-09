export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/ai/recommendation/history?limit=50
 * Superadmin: recent governance apply log (before/after snapshots, inverse hints).
 */
export async function GET(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;

  const { ctx } = gate;
  const { rid } = ctx;

  const denyRole = requireRoleOr403(ctx, ["superadmin"]);
  if (denyRole) return denyRole;

  const raw = req.nextUrl.searchParams.get("limit");
  const n = raw ? Number(raw) : 50;
  const limit = Number.isFinite(n) ? Math.min(100, Math.max(1, Math.floor(n))) : 50;

  const { data, error } = await supabaseAdmin()
    .from("ai_governance_apply_log")
    .select(
      "id, created_at, actor_email, action, dry_run, recommendation_id, inverse_action, inverse_payload, rolled_back_at, rollback_of_id, snapshot_before, snapshot_after, result",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return jsonErr(rid, "Kunne ikke lese historikk.", 503, "HISTORY_READ_FAILED", error.message);
  }

  return jsonOk(rid, { rows: Array.isArray(data) ? data : [] });
}
