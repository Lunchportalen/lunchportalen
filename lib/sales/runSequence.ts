/**
 * Sekvensmotor: foreslår utkast (ingen auto-send), respekterer tak og cooldown.
 */
import "server-only";

import { LEAD_PIPELINE_LIST_COLUMNS } from "@/lib/db/leadPipelineSelect";
import { verifyTable } from "@/lib/db/verifyTable";
import { getNextStep } from "@/lib/sales/conversationState";
import { generateSequenceMessage } from "@/lib/sales/sequenceMessage";
import { countSequenceDraftsTodayUtc, logSequenceStep } from "@/lib/sales/sequenceAudit";
import { saveDraftMessage } from "@/lib/sales/saveDraftMessage";
import { SEQUENCE_MAX_DRAFTS_PER_UTC_DAY, shouldSendNext } from "@/lib/sales/shouldSend";
import { applySequenceAdvanceAfterDraft } from "@/lib/sales/updateSequence";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "run_sequence_engine";
const MAX_LEADS = 4000;

export type RunSequenceEngineResult = {
  ok: boolean;
  dryRun: boolean;
  processed: number;
  drafts: Array<{ leadId: string; step: number }>;
  skippedDailyCap: boolean;
  error?: string;
};

export async function runSequenceEngine(rid: string): Promise<RunSequenceEngineResult> {
  const dryRun = process.env.SEQUENCE_ENGINE_MODE === "dry" || process.env.SALES_LOOP_MODE === "dry";

  if (!hasSupabaseAdminConfig()) {
    return { ok: false, dryRun, processed: 0, drafts: [], skippedDailyCap: false, error: "no_admin" };
  }

  const drafts: Array<{ leadId: string; step: number }> = [];
  let processed = 0;
  let skippedDailyCap = false;

  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "lead_pipeline", ROUTE);
    if (!ok) {
      return { ok: false, dryRun, processed: 0, drafts: [], skippedDailyCap: false, error: "lead_pipeline_unavailable" };
    }

    let remaining = SEQUENCE_MAX_DRAFTS_PER_UTC_DAY - (await countSequenceDraftsTodayUtc());
    if (remaining <= 0) {
      return { ok: true, dryRun, processed: 0, drafts: [], skippedDailyCap: true };
    }

    const { data, error } = await admin
      .from("lead_pipeline")
      .select(LEAD_PIPELINE_LIST_COLUMNS)
      .order("created_at", { ascending: true })
      .limit(MAX_LEADS);
    if (error) {
      return { ok: false, dryRun, processed: 0, drafts: [], skippedDailyCap: false, error: error.message };
    }

    const rows = Array.isArray(data) ? data : [];

    for (const row of rows) {
      if (remaining <= 0) {
        skippedDailyCap = true;
        break;
      }

      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id : "";
      if (!id) continue;

      const metaNorm =
        r.meta && typeof r.meta === "object" && !Array.isArray(r.meta)
          ? (r.meta as Record<string, unknown>)
          : {};
      const lead = { ...r, id, meta: metaNorm };
      const nextStep = getNextStep(lead);
      if (!nextStep) continue;
      if (!shouldSendNext(lead, nextStep)) continue;

      processed += 1;

      if (dryRun) {
        drafts.push({ leadId: id, step: nextStep.step });
        continue;
      }

      const m = lead.meta && typeof lead.meta === "object" && !Array.isArray(lead.meta) ? (lead.meta as Record<string, unknown>) : {};
      const company =
        typeof m.company_name === "string" && m.company_name.trim()
          ? m.company_name.trim()
          : typeof r.source_post_id === "string"
            ? r.source_post_id
            : null;

      const { text, fallbackUsed } = await generateSequenceMessage(
        {
          id,
          company_name: company,
          meta: Object.keys(metaNorm).length ? metaNorm : null,
        },
        nextStep,
      );

      const saved = await saveDraftMessage({
        leadId: id,
        message: text,
        rid,
        kind: "sequence",
        sequenceStep: nextStep.step,
      });

      if (!saved.saved) continue;

      if (saved.skipped) {
        continue;
      }

      await applySequenceAdvanceAfterDraft({
        leadId: id,
        step: nextStep,
        messagePreview: text,
        rid,
      });

      await logSequenceStep(rid, {
        leadId: id,
        step: nextStep.step,
        fallbackUsed,
        preview: text,
      });

      remaining -= 1;
      drafts.push({ leadId: id, step: nextStep.step });
    }

    return { ok: true, dryRun, processed, drafts, skippedDailyCap };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[runSequenceEngine]", msg);
    return { ok: false, dryRun, processed, drafts, skippedDailyCap, error: msg };
  }
}
