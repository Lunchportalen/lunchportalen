import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import type { EditorTextRunContext } from "@/lib/ai/editorTextSuggest";
import { verifyTable } from "@/lib/db/verifyTable";
import { evaluate } from "@/lib/experiment/evaluate";
import { promoteWinner } from "@/lib/experiment/promote";
import { sumOrdersForSocialPost } from "@/lib/growth/aggregateGrowth";
import { applyRevenueOpportunities } from "@/lib/revenue/applyLoop";
import { collectData } from "@/lib/revenue/data";
import { buildMetrics } from "@/lib/revenue/metrics";
import { findOpportunities } from "@/lib/revenue/opportunities";
import { runRevenueAutopilot } from "@/lib/revenue/runRevenueAutopilot";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

import { getRevenueGuardrails } from "./guardrails";

const ROUTE = "run_revenue_loop";
const EVAL_MIN_AGE_MS = 60 * 60 * 1000;

export type RunRevenueAutopilotLoopResult = {
  ok: boolean;
  rid: string;
  dryRun: boolean;
  guardrails: ReturnType<typeof getRevenueGuardrails>;
  baseline: Awaited<ReturnType<typeof runRevenueAutopilot>>;
  opportunities: ReturnType<typeof findOpportunities>;
  apply: Awaited<ReturnType<typeof applyRevenueOpportunities>>;
  evaluate: { evaluated: number; promoted: number };
  error?: string;
};

async function evaluateAndMaybePromote(admin: ReturnType<typeof supabaseAdmin>, rid: string): Promise<{ evaluated: number; promoted: number }> {
  const g = getRevenueGuardrails();
  const logOk = await verifyTable(admin, "ai_activity_log", ROUTE);
  if (!g.enabled || g.mode === "dry-run") return { evaluated: 0, promoted: 0 };

  const cutoff = new Date(Date.now() - EVAL_MIN_AGE_MS).toISOString();
  const { data: exps } = await admin
    .from("ab_experiments")
    .select("id, created_at, status")
    .in("status", ["draft", "active"])
    .lte("created_at", cutoff)
    .limit(25);

  let evaluated = 0;
  let promoted = 0;

  for (const row of exps ?? []) {
    const expId = String((row as Record<string, unknown>).id ?? "");
    if (!expId) continue;

    const { data: vars } = await admin.from("ab_variants").select("social_post_id, label").eq("experiment_id", expId);
    if (!Array.isArray(vars) || vars.length < 2) continue;

    const a = vars.find((v) => (v as Record<string, unknown>).label === "A") as { social_post_id?: unknown } | undefined;
    const b = vars.find((v) => (v as Record<string, unknown>).label === "B") as { social_post_id?: unknown } | undefined;
    const postA = typeof a?.social_post_id === "string" ? a.social_post_id : "";
    const postB = typeof b?.social_post_id === "string" ? b.social_post_id : "";
    if (!postA || !postB) continue;

    const before = await sumOrdersForSocialPost(admin, postA);
    const after = await sumOrdersForSocialPost(admin, postB);
    const ev = evaluate(
      { revenue: before.revenue, orders: before.orders },
      { revenue: after.revenue, orders: after.orders },
    );
    evaluated += 1;

    if (logOk) {
      const lr = buildAiActivityLogRow({
        action: "learning_pattern",
        metadata: {
          kind: "revenue_ab_evaluate",
          rid,
          experiment_id: expId,
          post_a: postA,
          post_b: postB,
          measurement: ev,
        },
      });
      await admin.from("ai_activity_log").insert({ ...lr, rid, status: "success" } as Record<string, unknown>);
    }

    /** Align with `evaluate()`: revenue first, then orders; no extra AI gate. */
    if (g.autoPromote && ev.winner === "B") {
      const pr = await promoteWinner(admin, { rid, winnerPostId: postB, targetPostId: postA });
      if (pr.ok) promoted += 1;
    }

    await admin.from("ab_experiments").update({ status: "completed" }).eq("id", expId);
  }

  return { evaluated, promoted };
}

/**
 * Closed loop: measure (orders) → opportunities → generate (AI) → A/B rows → measure → learn (deterministic).
 */
export async function runRevenueAutopilotLoop(params: {
  rid: string;
  aiCtx: EditorTextRunContext;
  /** Force dry-run regardless of guardrails.mode */
  dryRun?: boolean;
}): Promise<RunRevenueAutopilotLoopResult> {
  const dryRun = params.dryRun === true || getRevenueGuardrails().mode === "dry-run";

  if (!hasSupabaseAdminConfig()) {
    return {
      ok: false,
      rid: params.rid,
      dryRun,
      guardrails: getRevenueGuardrails(),
      baseline: {
        ok: false,
        posts: 0,
        orders: 0,
        leads: 0,
        winners: 0,
        losers: 0,
        actions: [],
        topRevenueSum: 0,
        topPerformingPosts: [],
        worstPerformingPosts: [],
        error: "no_supabase_admin",
      },
      opportunities: [],
      apply: [],
      evaluate: { evaluated: 0, promoted: 0 },
      error: "no_supabase_admin",
    };
  }

  const admin = supabaseAdmin();

  try {
    const data = await collectData();
    const metrics = buildMetrics(data);
    const opportunities = findOpportunities(metrics);

    const apply = await applyRevenueOpportunities(admin, {
      rid: params.rid,
      opportunities,
      data,
      aiCtx: params.aiCtx,
      dryRun,
    });

    const evaluate = dryRun ? { evaluated: 0, promoted: 0 } : await evaluateAndMaybePromote(admin, params.rid);

    const logOk = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (logOk) {
      const lr = buildAiActivityLogRow({
        action: "experiment_event",
        metadata: {
          kind: "revenue_closed_loop_summary",
          rid: params.rid,
          dryRun,
          opportunities: opportunities.length,
          apply_created: apply.filter((x) => x.status === "created").length,
          evaluated: evaluate.evaluated,
          promoted: evaluate.promoted,
        },
      });
      await admin.from("ai_activity_log").insert({ ...lr, rid: params.rid, status: "success" } as Record<string, unknown>);
    }

    const baseline = await runRevenueAutopilot(params.rid, { skipLog: false });

    return {
      ok: true,
      rid: params.rid,
      dryRun,
      guardrails: getRevenueGuardrails(),
      baseline,
      opportunities,
      apply,
      evaluate,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      rid: params.rid,
      dryRun,
      guardrails: getRevenueGuardrails(),
      baseline: {
        ok: false,
        posts: 0,
        orders: 0,
        leads: 0,
        winners: 0,
        losers: 0,
        actions: [],
        topRevenueSum: 0,
        topPerformingPosts: [],
        worstPerformingPosts: [],
        error: msg,
      },
      opportunities: [],
      apply: [],
      evaluate: { evaluated: 0, promoted: 0 },
      error: msg,
    };
  }
}
