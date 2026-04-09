export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { normalizeLeadPipelineRow } from "@/lib/pipeline/dealNormalize";
import { enrichPipelineDeal } from "@/lib/pipeline/enrichDeal";
import { advanceLead } from "@/lib/pipeline/progress";
import { getStageById, isPipelineStageId, statusFromPipelineStage, type PipelineStageId } from "@/lib/pipeline/stages";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { isMissingRelationError } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** PATCH: oppdaterer `meta.pipeline_stage` + sannsynlighet og synker `status`. */
export async function PATCH(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("pipeline_update_stage");

  if (!hasSupabaseAdminConfig()) {
    return jsonErr(rid, "Supabase admin er ikke konfigurert.", 503, "CONFIG_ERROR");
  }

  const body = await readJson(req);
  const dealId = typeof body.dealId === "string" ? body.dealId.trim() : "";
  const stageRaw = typeof body.stage === "string" ? body.stage.trim() : "";

  if (!isUuid(dealId)) {
    return jsonErr(rid, "Ugyldig dealId.", 422, "INVALID_DEAL_ID");
  }
  if (!isPipelineStageId(stageRaw)) {
    return jsonErr(rid, "Ugyldig stage.", 422, "INVALID_STAGE");
  }
  const stage: PipelineStageId = stageRaw;

  const admin = supabaseAdmin();

  const { data: row, error: fetchErr } = await admin.from("lead_pipeline").select("*").eq("id", dealId).maybeSingle();

  if (fetchErr) {
    console.error("[PIPELINE_STAGE_UPDATE]", { rid, dealId, code: fetchErr.code, message: fetchErr.message });
    if (isMissingRelationError(fetchErr)) {
      return jsonErr(rid, "Pipeline-tabell ikke tilgjengelig.", 503, "PIPELINE_UNAVAILABLE");
    }
    return jsonErr(rid, "Kunne ikke lese deal.", 500, "PIPELINE_READ_FAILED");
  }
  if (!row || typeof row !== "object") {
    return jsonErr(rid, "Fant ikke deal.", 404, "DEAL_NOT_FOUND");
  }

  const adv = await advanceLead(dealId, stage);
  if (adv.ok === false) {
    if (adv.reason === "NOT_FOUND") return jsonErr(rid, "Fant ikke deal.", 404, "DEAL_NOT_FOUND");
    if (adv.reason === "INVALID_STAGE") return jsonErr(rid, "Ugyldig stage.", 422, "INVALID_STAGE");
    return jsonErr(rid, "Kunne ikke oppdatere stage.", 500, "PIPELINE_UPDATE_FAILED");
  }

  const stageDef = getStageById(stage);
  const probability = stageDef?.probability ?? 0;
  const newStatus = statusFromPipelineStage(stage);

  const { data: updated, error: updErr } = await admin.from("lead_pipeline").select("*").eq("id", dealId).maybeSingle();

  if (updErr) {
    console.error("[PIPELINE_STAGE_UPDATE]", { rid, dealId, message: updErr.message, code: updErr.code });
    return jsonErr(rid, "Kunne ikke lese oppdatert deal.", 500, "PIPELINE_READ_FAILED");
  }

  const normalized = updated ? normalizeLeadPipelineRow(updated as Record<string, unknown>) : null;
  const deal = normalized ? enrichPipelineDeal(normalized) : null;

  console.log("[PIPELINE_STAGE_UPDATE]", {
    rid,
    dealId,
    stage,
    probability,
    status: newStatus,
  });

  return jsonOk(rid, { deal }, 200);
}
