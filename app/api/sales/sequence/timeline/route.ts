export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getNextStep } from "@/lib/sales/conversationState";
import { verifyTable } from "@/lib/db/verifyTable";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid ?? "";

  const leadId = req.nextUrl.searchParams.get("leadId")?.trim() ?? "";
  if (!leadId) {
    return jsonErr(rid, "leadId er påkrevd.", 422, "LEAD_ID_REQUIRED");
  }

  if (!hasSupabaseAdminConfig()) {
    return jsonErr(rid, "Supabase admin er ikke konfigurert.", 503, "CONFIG_ERROR");
  }

  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "lead_pipeline", "sequence_timeline");
    if (!ok) {
      return jsonErr(rid, "lead_pipeline er ikke tilgjengelig.", 503, "TABLE_UNAVAILABLE");
    }

    const { data: row, error } = await admin.from("lead_pipeline").select("meta").eq("id", leadId).maybeSingle();
    if (error || !row || typeof row !== "object") {
      return jsonErr(rid, "Fant ikke lead.", 404, "LEAD_NOT_FOUND");
    }

    const meta =
      (row as { meta?: unknown }).meta && typeof (row as { meta?: unknown }).meta === "object" && !Array.isArray((row as { meta?: unknown }).meta)
        ? ((row as { meta?: unknown }).meta as Record<string, unknown>)
        : {};

    const timeline = Array.isArray(meta.sequence_timeline) ? meta.sequence_timeline : [];
    const nextStep = getNextStep({ meta });
    const suggested =
      typeof meta.sequence_draft_message === "string" && meta.sequence_draft_message.trim()
        ? meta.sequence_draft_message.trim()
        : typeof meta.sequence_objection_suggestion === "string"
          ? meta.sequence_objection_suggestion.trim()
          : null;

    return jsonOk(
      rid,
      {
        timeline,
        nextStep: nextStep ?? null,
        suggestedReply: suggested,
        sequencePaused: meta.sequence_paused === true,
        conversationActive: meta.conversation_active === true,
        lastInbound: typeof meta.sequence_last_response === "string" ? meta.sequence_last_response : null,
      },
      200,
    );
  } catch (e) {
    return jsonErr(rid, "Kunne ikke laste tidslinje.", 500, "TIMELINE_FAILED", e);
  }
}
