export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ALERT_KIND = "monitoring_alert";

export type SystemAlertRow = {
  id: string;
  severity: string;
  message: string;
  explain: string;
  alertType: string;
  createdAt: string;
  rid: string | null;
};

/**
 * Recent monitoring alerts for superadmin UI (medium+; low is stored with uiVisible for rate limit only).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid("superadmin_system_alerts");
  const gate = await scopeOr401(req);
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
      .limit(120);

    if (error) {
      return jsonErr(rid, error.message, 500, "QUERY_FAILED");
    }

    const alerts: SystemAlertRow[] = [];
    if (Array.isArray(data)) {
      for (const row of data) {
        const m = row.metadata as Record<string, unknown> | null;
        if (!m || m.kind !== ALERT_KIND) continue;
        if (m.uiVisible === false) continue;
        const sev = typeof m.severity === "string" ? m.severity : "";
        if (sev === "low") continue;
        alerts.push({
          id: String(row.id),
          severity: sev,
          message: typeof m.message === "string" ? m.message : "",
          explain: typeof m.explain === "string" ? m.explain : "",
          alertType: typeof m.alertType === "string" ? m.alertType : "",
          createdAt: typeof row.created_at === "string" ? row.created_at : "",
          rid: typeof m.rid === "string" ? m.rid : null,
        });
        if (alerts.length >= 40) break;
      }
    }

    return jsonOk(rid, { alerts }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, msg, 500, "SYSTEM_ALERTS_FAILED");
  }
}
