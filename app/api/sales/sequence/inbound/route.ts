export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { resolvePipelineStage } from "@/lib/pipeline/dealNormalize";
import { handleObjection } from "@/lib/sales/handleObjection";
import { applyInboundSequenceMeta } from "@/lib/sales/updateSequence";
import { verifyTable } from "@/lib/db/verifyTable";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid ?? "";

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_JSON");
  }

  const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!leadId) {
    return jsonErr(rid, "leadId er påkrevd.", 422, "LEAD_ID_REQUIRED");
  }
  if (!message) {
    return jsonErr(rid, "message er påkrevd.", 422, "MESSAGE_REQUIRED");
  }

  if (!hasSupabaseAdminConfig()) {
    return jsonErr(rid, "Supabase admin er ikke konfigurert.", 503, "CONFIG_ERROR");
  }

  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "lead_pipeline", "sequence_inbound");
    if (!ok) {
      return jsonErr(rid, "lead_pipeline er ikke tilgjengelig.", 503, "TABLE_UNAVAILABLE");
    }

    const { data: row, error } = await admin.from("lead_pipeline").select("*").eq("id", leadId).maybeSingle();
    if (error || !row || typeof row !== "object") {
      return jsonErr(rid, "Fant ikke lead.", 404, "LEAD_NOT_FOUND");
    }

    const r = row as Record<string, unknown>;
    const meta =
      r.meta && typeof r.meta === "object" && !Array.isArray(r.meta) ? (r.meta as Record<string, unknown>) : {};
    const company =
      typeof meta.company_name === "string" && meta.company_name.trim()
        ? meta.company_name.trim()
        : typeof r.source_post_id === "string"
          ? r.source_post_id
          : null;

    const stage = resolvePipelineStage(r);

    const objection = await handleObjection(
      {
        id: leadId,
        company_name: company,
        meta,
        stage,
      },
      message,
      { rid },
    );

    await applyInboundSequenceMeta({
      leadId,
      message,
      rid,
      objectionReplyPreview: objection.reply,
    });

    return jsonOk(
      rid,
      {
        objection: {
          type: objection.type,
          strategy: objection.strategy,
          reply: objection.reply,
          fallbackUsed: objection.fallbackUsed,
        },
      },
      200,
    );
  } catch (e) {
    console.error("[sequence_inbound]", e);
    return jsonErr(rid, "Kunne ikke behandle innkommende melding.", 500, "INBOUND_FAILED");
  }
}
