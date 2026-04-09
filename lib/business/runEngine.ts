import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import type { EditorTextRunContext } from "@/lib/ai/editorTextSuggest";
import {
  runSocialAbEvaluations,
  type SocialAbEvaluationSummary,
} from "@/lib/experiment/runSocialAbEvaluations";
import { makeRid } from "@/lib/http/respond";
import { applyRevenueOpportunities, type ApplyLoopResult } from "@/lib/revenue/applyLoop";
import { collectData } from "@/lib/revenue/data";
import { buildMetrics } from "@/lib/revenue/metrics";
import { findOpportunities } from "@/lib/revenue/opportunities";
import type { SupabaseClient } from "@supabase/supabase-js";

const ROUTE = "run_business_engine";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

export type RunBusinessEngineOptions = {
  /** Defaults to a new rid. */
  rid?: string;
  /** If omitted, uses REVENUE_AUTOPILOT_COMPANY_ID / REVENUE_AUTOPILOT_USER_ID. */
  aiCtx?: EditorTextRunContext;
};

export type RunBusinessEngineResult = {
  ok: boolean;
  rid: string;
  skipped?: "no_opportunities" | "missing_ai_context";
  apply?: ApplyLoopResult[];
  socialAb?: SocialAbEvaluationSummary;
  error?: string;
};

/**
 * Central business loop: collect → metrics → opportunities → apply (generate + SoMe A/B) → social A/B eval → log.
 * Reuses revenue loop modules; deterministic ordering from findOpportunities.
 */
export async function runBusinessEngine(
  supabase: SupabaseClient,
  options?: RunBusinessEngineOptions,
): Promise<RunBusinessEngineResult> {
  const rid = options?.rid ?? makeRid("biz_engine");

  const data = await collectData(supabase);
  const metrics = buildMetrics(data);
  const opportunities = findOpportunities(metrics);

  if (!opportunities.length) {
    return { ok: true, rid, skipped: "no_opportunities" };
  }

  const companyId = options?.aiCtx?.companyId ?? safeStr(process.env.REVENUE_AUTOPILOT_COMPANY_ID);
  const userId = options?.aiCtx?.userId ?? safeStr(process.env.REVENUE_AUTOPILOT_USER_ID);
  if (!companyId || !userId) {
    return { ok: false, rid, skipped: "missing_ai_context", error: "REVENUE_AUTOPILOT_COMPANY_ID / REVENUE_AUTOPILOT_USER_ID" };
  }

  const aiCtx: EditorTextRunContext = { companyId, userId };
  const dryRun = safeStr(process.env.REVENUE_AUTOPILOT_CRON_DRY_RUN) === "true";

  const apply = await applyRevenueOpportunities(supabase, {
    rid,
    opportunities: [opportunities[0]!],
    data,
    aiCtx,
    dryRun,
  });

  let socialAb: SocialAbEvaluationSummary | undefined;
  try {
    socialAb = await runSocialAbEvaluations(supabase, rid);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, rid, apply, error: msg };
  }

  const logOk = await verifyTable(supabase, "ai_activity_log", ROUTE);
  if (logOk) {
    const target = opportunities[0]!;
    const created = apply[0];
    const lr = buildAiActivityLogRow({
      action: "experiment_event",
      metadata: {
        kind: "business_engine_run",
        rid,
        target: target.postId,
        apply_status: created?.status,
        experiment_id: created?.experimentId,
      },
    });
    await supabase.from("ai_activity_log").insert({ ...lr, rid, status: "success" } as Record<string, unknown>);
  }

  return { ok: true, rid, apply, socialAb };
}
