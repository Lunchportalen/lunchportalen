export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { listAiExperiments } from "@/lib/ai/experiments/aiExperimentsRepo";
import { EXPERIMENT_RESULT_KIND } from "@/lib/experiment/auditLog";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

type MeasurementRow = {
  deltaRevenue?: number;
  deltaConversion?: number;
  deltaErrors?: number;
};

/**
 * GET: CMS growth experiments (preview A/B) + siste måling fra audit-logg.
 */
export async function GET(_req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(_req, "GET", async () => {
  const rid = makeRid("superadmin_experiments");
  const gate = await scopeOr401(_req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  if (!hasSupabaseAdminConfig()) {
    return jsonErr(rid, "Database utilgjengelig.", 503, "DB_UNAVAILABLE");
  }

  try {
    const admin = supabaseAdmin();
    const experiments = await listAiExperiments(admin, { limit: 80 });
    const filtered = experiments.filter(
      (e) => e.target_type === "cms_preview" || e.name.startsWith("growth_copy_")
    );

    const { data: audits, error: aErr } = await admin
      .from("ai_activity_log")
      .select("metadata, created_at")
      .eq("action", "audit")
      .order("created_at", { ascending: false })
      .limit(500);

    if (aErr) {
      return jsonErr(rid, aErr.message, 500, "EXPERIMENTS_AUDIT_FAILED");
    }

    const byExperimentId = new Map<string, { measurement: MeasurementRow | null; at: string }>();
    for (const row of audits ?? []) {
      const m = row?.metadata as Record<string, unknown> | undefined;
      if (!m || m.kind !== EXPERIMENT_RESULT_KIND) continue;
      const eid = m.experimentId;
      if (typeof eid !== "string" || !eid) continue;
      if (byExperimentId.has(eid)) continue;
      const meas = m.measurement as MeasurementRow | undefined;
      byExperimentId.set(eid, {
        measurement: meas && typeof meas === "object" ? meas : null,
        at: String(row.created_at ?? ""),
      });
    }

    const merged = filtered.map((e) => {
      const aud = byExperimentId.get(e.id);
      const m = aud?.measurement;
      const winner =
        e.winner_variant ??
        (m && typeof m.deltaErrors === "number" && m.deltaErrors < 0
          ? "B"
          : m && typeof m.deltaRevenue === "number" && m.deltaRevenue > 0
            ? "B"
            : null);
      return {
        id: e.id,
        name: e.name,
        status: e.status,
        primaryMetric: e.primary_metric,
        pageId: e.page_id,
        winnerVariant: e.winner_variant ?? winner,
        variants: e.variants,
        createdAt: e.created_at,
        deltaRevenue: m?.deltaRevenue ?? null,
        deltaConversion: m?.deltaConversion ?? null,
        deltaErrors: m?.deltaErrors ?? null,
        measuredAt: aud?.at ?? null,
      };
    });

    return jsonOk(rid, { experiments: merged }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, msg, 500, "EXPERIMENTS_LIST_FAILED");
  }
  });
}
