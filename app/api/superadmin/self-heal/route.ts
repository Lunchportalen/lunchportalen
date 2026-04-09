export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { SELF_HEAL_AUDIT_KIND } from "@/lib/selfheal/audit";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export type SelfHealHistoryRow = {
  id: string;
  createdAt: string;
  monitoringRid: string | null;
  mode: string | null;
  enabled: boolean | null;
  hadExecution: boolean | null;
  note: string | null;
  planned: unknown;
  results: unknown;
  verification: unknown;
};

/**
 * Recent self-heal audit rows (policy + outcomes). Superadmin only.
 */
export async function GET(_req: NextRequest): Promise<Response> {
  const rid = makeRid("superadmin_self_heal");
  const gate = await scopeOr401(_req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  if (!hasSupabaseAdminConfig()) {
    return jsonErr(rid, "Database utilgjengelig.", 503, "DB_UNAVAILABLE");
  }

  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("ai_activity_log")
      .select("id, metadata, created_at")
      .eq("action", "audit")
      .order("created_at", { ascending: false })
      .limit(150);

    if (error) {
      return jsonErr(rid, error.message, 500, "QUERY_FAILED");
    }

    const runs: SelfHealHistoryRow[] = [];
    if (Array.isArray(data)) {
      for (const row of data) {
        const m = row.metadata as Record<string, unknown> | null;
        if (!m || m.kind !== SELF_HEAL_AUDIT_KIND) continue;
        const cfg = m.config as Record<string, unknown> | undefined;
        runs.push({
          id: String(row.id),
          createdAt: typeof row.created_at === "string" ? row.created_at : "",
          monitoringRid: typeof m.monitoringRid === "string" ? m.monitoringRid : null,
          mode: cfg && typeof cfg.mode === "string" ? cfg.mode : null,
          enabled: cfg && typeof cfg.enabled === "boolean" ? cfg.enabled : null,
          hadExecution: typeof m.hadExecution === "boolean" ? m.hadExecution : null,
          note: typeof m.note === "string" ? m.note : null,
          planned: m.planned ?? null,
          results: m.results ?? null,
          verification: m.verification ?? null,
        });
        if (runs.length >= 25) break;
      }
    }

    return jsonOk(rid, { runs }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, msg, 500, "SELF_HEAL_HISTORY_FAILED");
  }
}
