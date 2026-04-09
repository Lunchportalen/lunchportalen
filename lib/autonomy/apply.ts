import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { EditorTextRunContext } from "@/lib/ai/editorTextSuggest";
import { getRevenueGuardrails } from "@/lib/autonomy/guardrails";
import type { CollectedLoopData } from "@/lib/revenue/data";
import { applyRevenueOpportunities } from "@/lib/revenue/applyLoop";
import type { RevenueOpportunity } from "@/lib/revenue/opportunities";

export type { ApplyLoopResult } from "@/lib/revenue/applyLoop";

/**
 * Spec-shaped entry: bounded opportunities → AI copy (generation only) → SoMe A/B rows (`createSocialAbExperiment`).
 * Idempotent within cooldown; respects kill switch + dry-run.
 */
export async function applyActions(
  admin: SupabaseClient,
  opportunities: RevenueOpportunity[],
  data: CollectedLoopData,
  opts: { rid: string; aiCtx: EditorTextRunContext; dryRun?: boolean }
) {
  const g = getRevenueGuardrails();
  const dryRun = opts.dryRun === true || g.mode === "dry-run";
  return applyRevenueOpportunities(admin, {
    rid: opts.rid,
    opportunities,
    data,
    aiCtx: opts.aiCtx,
    dryRun,
  });
}
