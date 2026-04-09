import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getRevenueGuardrails } from "@/lib/autonomy/guardrails";
import { createSocialAbExperiment } from "@/lib/experiment/socialAb";
import { generateVariant } from "@/lib/experiment/generate";
import type { EditorTextRunContext } from "@/lib/ai/editorTextSuggest";
import type { CollectedLoopData } from "@/lib/revenue/data";
import type { RevenueOpportunity } from "@/lib/revenue/opportunities";
import { readPostTextAndSource } from "@/lib/revenue/model";
import { opsLog } from "@/lib/ops/log";

export type ApplyLoopResult = {
  postId: string;
  status: "created" | "skipped" | "failed";
  detail?: string;
  experimentId?: string;
};

async function hasCooldownConflict(
  admin: SupabaseClient,
  postId: string,
  cooldownHours: number
): Promise<boolean> {
  const cutoff = new Date(Date.now() - cooldownHours * 3600 * 1000).toISOString();
  const { data } = await admin
    .from("ab_variants")
    .select("id")
    .eq("social_post_id", postId)
    .gte("created_at", cutoff)
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

async function hasOtherActiveExperiment(admin: SupabaseClient): Promise<boolean> {
  const { data } = await admin.from("ab_experiments").select("id").eq("status", "active").limit(1).maybeSingle();
  return !!(data && typeof data === "object" && (data as { id?: unknown }).id);
}

/**
 * Bounded, idempotent best-effort: generates copy (AI) + creates SoMe A/B rows.
 */
export async function applyRevenueOpportunities(
  admin: SupabaseClient,
  params: {
    rid: string;
    opportunities: RevenueOpportunity[];
    data: CollectedLoopData;
    aiCtx: EditorTextRunContext;
    dryRun: boolean;
  }
): Promise<ApplyLoopResult[]> {
  const g = getRevenueGuardrails();
  const results: ApplyLoopResult[] = [];
  const slice = params.opportunities.slice(0, g.maxExperimentsPerRun);

  if (params.dryRun || g.mode === "dry-run") {
    for (const o of slice) {
      results.push({ postId: o.postId, status: "skipped", detail: "dry_run" });
    }
    return results;
  }

  if (!g.enabled) {
    for (const o of slice) {
      results.push({ postId: o.postId, status: "skipped", detail: "kill_switch" });
    }
    return results;
  }

  if (!g.allowedActions.update_copy) {
    for (const o of slice) {
      results.push({ postId: o.postId, status: "skipped", detail: "policy_update_copy" });
    }
    return results;
  }

  const activeExists = await hasOtherActiveExperiment(admin);
  const expStatus: "draft" | "active" = g.mode === "auto" && !activeExists ? "active" : "draft";

  for (const o of slice) {
    if (await hasCooldownConflict(admin, o.postId, g.cooldownHours)) {
      results.push({ postId: o.postId, status: "skipped", detail: "cooldown" });
      continue;
    }

    const post = params.data.posts.find((p) => String((p as Record<string, unknown>).id ?? "") === o.postId);
    if (!post) {
      results.push({ postId: o.postId, status: "failed", detail: "post_missing" });
      continue;
    }

    const { text } = readPostTextAndSource(post as Record<string, unknown>);
    const improved = await generateVariant(text, params.aiCtx);
    if (!improved.trim()) {
      results.push({ postId: o.postId, status: "failed", detail: "generate_empty" });
      continue;
    }

    const created = await createSocialAbExperiment(admin, {
      rid: params.rid,
      basePostId: o.postId,
      variantText: improved,
      status: expStatus,
    });

    if (created.ok === false) {
      opsLog("revenue_apply_ab_failed", { rid: params.rid, postId: o.postId, error: created.error });
      results.push({ postId: o.postId, status: "failed", detail: created.error });
      continue;
    }

    results.push({
      postId: o.postId,
      status: "created",
      experimentId: created.experimentId,
    });
  }

  return results;
}
