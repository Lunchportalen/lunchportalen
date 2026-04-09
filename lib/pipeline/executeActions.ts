/**
 * Kjør godkjente handlinger — kun etter eksplisitt godkjenning.
 * Ingen LinkedIn-automatisering her; kaller eksisterende runSalesAgent (utkast/kø).
 */
import "server-only";

import { enrichPipelineDeal } from "@/lib/pipeline/enrichDeal";
import { logPipelineActionExecuted } from "@/lib/pipeline/logPipelineAi";
import { normalizeLeadPipelineRow } from "@/lib/pipeline/dealNormalize";
import { runSalesAgent } from "@/lib/sales/runAgent";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export type ExecutePipelineActionsResult = {
  ok: boolean;
  results: Array<{ leadId: string; executed: boolean; error?: string }>;
  queueLength?: number;
};

async function loadEnrichedDeal(leadId: string): Promise<ReturnType<typeof enrichPipelineDeal> | null> {
  if (!hasSupabaseAdminConfig()) return null;
  const admin = supabaseAdmin();
  const { data: row, error } = await admin.from("lead_pipeline").select("*").eq("id", leadId).maybeSingle();
  if (error || !row || typeof row !== "object") {
    console.error("[executeActions_load]", leadId, error?.message);
    return null;
  }
  const card = normalizeLeadPipelineRow(row as Record<string, unknown>);
  if (!card) return null;
  return enrichPipelineDeal(card);
}

/**
 * Godkjente leadIds → én runSalesAgent-batch (deterministisk, idempotent via idempotencyPrefix).
 * Kun typer som skal trigge salgsagent (ingen deprioritize/observe).
 */
export async function executeApprovedPipelineActions(
  leadIds: string[],
  opts: { rid: string; actorEmail?: string | null },
): Promise<ExecutePipelineActionsResult> {
  const uniq = [...new Set(leadIds.map((x) => String(x).trim()).filter(Boolean))];
  const results: ExecutePipelineActionsResult["results"] = [];

  if (uniq.length === 0) {
    return { ok: true, results: [] };
  }

  const loaded: NonNullable<Awaited<ReturnType<typeof loadEnrichedDeal>>>[] = [];
  for (const id of uniq) {
    const d = await loadEnrichedDeal(id);
    if (d) loaded.push(d);
    else results.push({ leadId: id, executed: false, error: "lead_not_found" });
  }

  if (loaded.length === 0) {
    return { ok: false, results };
  }

  try {
    const out = await runSalesAgent(loaded, {
      idempotencyPrefix: opts.rid,
      actorEmail: opts.actorEmail ?? null,
    });

    for (const d of loaded) {
      results.push({ leadId: d.id, executed: true });
      await logPipelineActionExecuted(opts.rid, d.id, "sales_agent_batch", {
        queueItems: out.queue.length,
      });
    }

    console.log("[PIPELINE_ACTIONS_EXECUTED]", {
      rid: opts.rid,
      count: loaded.length,
      queueItems: out.queue.length,
    });

    return { ok: true, results, queueLength: out.queue.length };
  } catch (err) {
    console.error("[ACTION_FAIL]", err);
    const msg = err instanceof Error ? err.message : String(err);
    for (const d of loaded) {
      results.push({ leadId: d.id, executed: false, error: msg });
    }
    return { ok: false, results };
  }
}
