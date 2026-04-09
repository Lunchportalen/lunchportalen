import "server-only";

import { verifyTable } from "@/lib/db/verifyTable";
import {
  getStageById,
  isPipelineStageId,
  statusFromPipelineStage,
  type PipelineStageId,
} from "@/lib/pipeline/stages";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "advance_lead";

/**
 * Oppdaterer `meta.pipeline_stage` + sannsynlighet og synker `status` (samme sannhet som PATCH /api/pipeline/update-stage).
 * Fail-closed: ugyldig trinn → ok: false.
 */
export async function advanceLead(
  leadId: string,
  stage: string,
): Promise<{ ok: true } | { ok: false; reason: "INVALID_STAGE" | "NOT_FOUND" | "DB_ERROR" }> {
  const id = String(leadId ?? "").trim();
  if (!id || !isPipelineStageId(stage)) {
    return { ok: false, reason: "INVALID_STAGE" };
  }
  const pipelineStage: PipelineStageId = stage;

  try {
    const admin = supabaseAdmin();
    const tableOk = await verifyTable(admin, "lead_pipeline", ROUTE);
    if (!tableOk) return { ok: false, reason: "DB_ERROR" };

    const { data: row, error: fetchErr } = await admin.from("lead_pipeline").select("*").eq("id", id).maybeSingle();
    if (fetchErr || !row || typeof row !== "object") {
      return { ok: false, reason: "NOT_FOUND" };
    }

    const existing = row as Record<string, unknown>;
    const metaRaw = existing.meta;
    const meta =
      metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw)
        ? ({ ...(metaRaw as Record<string, unknown>) } as Record<string, unknown>)
        : {};

    const stageDef = getStageById(pipelineStage);
    const probability = stageDef?.probability ?? 0;
    meta.pipeline_stage = pipelineStage;
    meta.probability = probability;
    meta.last_stage_change_at = new Date().toISOString();

    const newStatus = statusFromPipelineStage(pipelineStage);

    const { error: updErr } = await admin
      .from("lead_pipeline")
      .update({
        meta,
        status: newStatus,
      })
      .eq("id", id);

    if (updErr) {
      console.error("[advanceLead]", updErr.message);
      return { ok: false, reason: "DB_ERROR" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[advanceLead]", e instanceof Error ? e.message : String(e));
    return { ok: false, reason: "DB_ERROR" };
  }
}
