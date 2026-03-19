import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getExperimentById, updateExperiment } from "@/lib/backoffice/experiments/experimentsRepo";
import { getExperimentStats } from "@/lib/ai/experiments/analytics";
import { isExperimentType, isExperimentStatus } from "@/lib/backoffice/experiments/model";

export const dynamic = "force-dynamic";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const { id } = await context.params;
  if (!id?.trim()) return jsonErr(ctx.rid, "Mangler id.", 400, "BAD_REQUEST");

  try {
    const supabase = supabaseAdmin();
    const row = await getExperimentById(supabase, id);
    if (!row) return jsonErr(ctx.rid, "Eksperiment ikke funnet.", 404, "NOT_FOUND");

    const stats = await getExperimentStats(supabase, row.experiment_id);
    return jsonOk(ctx.rid, { ok: true, data: { ...row, stats } }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Get experiment failed";
    return jsonErr(ctx.rid, msg, 500, "GET_FAILED");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const { id } = await context.params;
  if (!id?.trim()) return jsonErr(ctx.rid, "Mangler id.", 400, "BAD_REQUEST");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");

  const update: { name?: string; type?: import("@/lib/backoffice/experiments/model").ExperimentType; status?: import("@/lib/backoffice/experiments/model").ExperimentStatus; config?: Record<string, unknown>; started_at?: string | null; completed_at?: string | null } = {};
  if (typeof o.name === "string") update.name = o.name.trim();
  if (isExperimentType(o.type)) update.type = o.type;
  if (isExperimentStatus(o.status)) {
    update.status = o.status;
    const now = new Date().toISOString();
    if (o.status === "active") update.started_at = now;
    if (o.status === "completed") update.completed_at = now;
  }
  if (o.config != null && typeof o.config === "object" && !Array.isArray(o.config)) update.config = o.config as Record<string, unknown>;

  if (Object.keys(update).length === 0) {
    return jsonErr(ctx.rid, "Ingen gyldige felt å oppdatere.", 400, "BAD_REQUEST");
  }

  try {
    const supabase = supabaseAdmin();
    const row = await updateExperiment(supabase, id, update);
    if (update.status === "completed" && row.experiment_id) {
      try {
        const { getExperimentStats } = await import("@/lib/ai/experiments/analytics");
        const { detectWinningVariant } = await import("@/lib/ai/capabilities/detectWinningVariant");
        const { storeExperimentLearning } = await import("@/lib/ai/capabilities/storeExperimentLearning");
        const { insertExperimentMemoryBatch } = await import("@/lib/ai/experiments/experimentMemory");
        const stats = await getExperimentStats(supabase, row.experiment_id);
        if (stats.byVariant.length > 0) {
          const detection = detectWinningVariant({
            experimentId: row.experiment_id,
            variants: stats.byVariant,
          });
          const { records } = storeExperimentLearning({
            experimentId: row.experiment_id,
            variants: stats.byVariant,
            detectionResult: detection,
            pageId: row.page_id ?? undefined,
          });
          await insertExperimentMemoryBatch(supabase, records);
        }
      } catch (learnErr) {
        const { opsLog } = await import("@/lib/ops/log");
        opsLog("ai_experiment_memory.record_failed", {
          experimentId: row.experiment_id,
          error: learnErr instanceof Error ? learnErr.message : String(learnErr),
        });
      }
    }
    return jsonOk(ctx.rid, { ok: true, data: row }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update experiment failed";
    return jsonErr(ctx.rid, msg, 500, "UPDATE_FAILED");
  }
}
