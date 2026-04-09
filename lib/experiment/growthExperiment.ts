import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

import type { EditorTextRunContext } from "@/lib/ai/editorTextSuggest";
import { insertAiExperiment, updateAiExperiment } from "@/lib/ai/experiments/aiExperimentsRepo";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { improveContent } from "@/lib/ai/improveContent";
import { fetchPageVersionSnapshot } from "@/lib/backoffice/content/pageVersionsRepo";
import { extractFirstTextFromBody } from "@/lib/content/blocksText";
import { applyImprovedTextToPreviewBody } from "@/lib/content/update";
import { buildGraphMetricsPayload } from "@/lib/observability/graphMetrics";
import { aggregateCurrentMetrics } from "@/lib/monitoring/metrics";
import { persistStrategyBoosts, persistStrategyPenalties } from "@/lib/learning/boosts";
import { opsLog } from "@/lib/ops/log";

import { createVariant } from "./ab";
import { evaluateExperiment } from "./evaluate";
import { logExperimentResult } from "./auditLog";
import type { GrowthMetrics, ImpactMeasurement } from "./measure";
import { measureImpact } from "./measure";
import { generateCopyVariant } from "./generateCopyVariant";
import { buildHypothesis, type PostMetricsInput } from "./hypothesis";

async function ensurePreviewVariantFromProd(
  admin: SupabaseClient,
  pageId: string,
  locale: string,
  rid: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: prod, error: e1 } = await admin
    .from("content_page_variants")
    .select("id, body")
    .eq("page_id", pageId)
    .eq("locale", locale)
    .eq("environment", "prod")
    .maybeSingle();

  if (e1) return { ok: false, error: e1.message };
  if (!prod || typeof prod !== "object") {
    return { ok: false, error: "prod_variant_missing" };
  }

  const { data: prev, error: e2 } = await admin
    .from("content_page_variants")
    .select("id")
    .eq("page_id", pageId)
    .eq("locale", locale)
    .eq("environment", "preview")
    .maybeSingle();

  if (e2) return { ok: false, error: e2.message };
  if (prev) return { ok: true };

  const body = (prod as { body?: unknown }).body ?? { version: 1, blocks: [] };
  const { error: ins } = await admin.from("content_page_variants").insert({
    id: randomUUID(),
    page_id: pageId,
    locale,
    environment: "preview",
    body,
    created_at: new Date().toISOString(),
  } as Record<string, unknown>);

  if (ins) {
    opsLog("growth_preview_seed_failed", { rid, message: ins.message });
    return { ok: false, error: ins.message };
  }
  opsLog("growth_preview_seeded_from_prod", { rid, pageId });
  return { ok: true };
}

export type GrowthCopyResult =
  | {
      ok: true;
      experimentId: string;
      improvedText: string;
      originalText: string;
      versionNumber: number;
      measurement: ImpactMeasurement;
    }
  | { ok: false; error: string };

/**
 * Real, versioned preview change + ai_experiments row (A vs B body snapshots).
 */
export async function runGrowthCopyExperiment(params: {
  admin: SupabaseClient;
  pageId: string;
  locale: string;
  rid: string;
  aiCtx: EditorTextRunContext;
  createdBy: string | null;
  metricsBefore: GrowthMetrics;
  postMetrics?: PostMetricsInput;
}): Promise<GrowthCopyResult> {
  const seeded = await ensurePreviewVariantFromProd(params.admin, params.pageId, params.locale, params.rid);
  if (seeded.ok === false) {
    return { ok: false, error: seeded.error };
  }

  const snap = await fetchPageVersionSnapshot(params.admin, params.pageId, params.locale, "preview");
  if (!snap) {
    return { ok: false, error: "snapshot_failed" };
  }

  const originalText = extractFirstTextFromBody(snap.body);
  if (!originalText || !originalText.trim()) {
    return { ok: false, error: "no_rich_text_block" };
  }

  const improvedText =
    params.postMetrics != null
      ? await generateCopyVariant(originalText, buildHypothesis(params.postMetrics), params.aiCtx)
      : await improveContent(originalText, params.aiCtx);
  if (!improvedText.trim()) {
    return { ok: false, error: "improve_empty" };
  }

  const applied = await applyImprovedTextToPreviewBody(params.admin, {
    pageId: params.pageId,
    locale: params.locale,
    improvedText,
    createdBy: params.createdBy,
    rid: params.rid,
  });

  if (applied.ok === false) {
    return { ok: false, error: applied.error };
  }

  const snapAfter = await fetchPageVersionSnapshot(params.admin, params.pageId, params.locale, "preview");
  const ab = createVariant(snap.body, snapAfter?.body ?? snap.body);

  const payloadAfter = await buildGraphMetricsPayload({ windowHours: 6, activityLimit: 3000 });
  const mAfter = aggregateCurrentMetrics(payloadAfter);

  const metricsAfter: GrowthMetrics = {
    revenue: params.metricsBefore.revenue,
    conversion: params.metricsBefore.conversion,
    errors: mAfter.errors,
  };

  const measurement = measureImpact(params.metricsBefore, metricsAfter);

  let experimentId: string;
  try {
    const row = await insertAiExperiment(params.admin, {
      name: `growth_copy_${params.rid}`,
      status: "draft",
      target_type: "cms_preview",
      primary_metric: "errors_delta",
      page_id: params.pageId,
      variants: [
        { id: "A", label: "baseline_preview", body: ab.A },
        { id: "B", label: "improved_preview", body: ab.B },
      ],
    });
    experimentId = row.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    opsLog("ai_experiment_insert_failed", { rid: params.rid, message: msg });
    return { ok: false, error: msg };
  }

  const revenueEval = evaluateExperiment(
    { revenue: params.metricsBefore.revenue },
    { revenue: metricsAfter.revenue }
  );

  const win = measurement.deltaErrors < 0 || measurement.deltaRevenue > 0;
  if (win) {
    try {
      await updateAiExperiment(params.admin, experimentId, {
        status: "completed",
        winner_variant: "B",
        completed_at: new Date().toISOString(),
      });
    } catch (e) {
      opsLog("ai_experiment_winner_update_failed", {
        rid: params.rid,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  } else {
    try {
      await updateAiExperiment(params.admin, experimentId, {
        status: "completed",
        winner_variant: "A",
        completed_at: new Date().toISOString(),
      });
    } catch (e) {
      opsLog("ai_experiment_winner_update_failed", {
        rid: params.rid,
        message: e instanceof Error ? e.message : String(e),
      });
    }
    await persistStrategyPenalties(params.admin, {
      rid: params.rid,
      penalties: { improve_landing_page: 0.97 },
    });
  }

  await logExperimentResult(params.admin, {
    rid: params.rid,
    experimentId,
    before: params.metricsBefore,
    after: metricsAfter,
    measurement,
  });

  if (win) {
    await persistStrategyBoosts(params.admin, {
      rid: params.rid,
      boosts: { improve_landing_page: 1.05 },
    });

    try {
      const row = buildAiActivityLogRow({
        action: "learning_pattern",
        page_id: params.pageId,
        actor_user_id: params.createdBy,
        metadata: {
          winning_pattern: "growth_copy_preview",
          revenue_gain: revenueEval.uplift,
          winner: revenueEval.winner,
          experimentId,
        },
      });
      const { error: learnErr } = await params.admin.from("ai_activity_log").insert(row as Record<string, unknown>);
      if (learnErr) {
        opsLog("growth_learning_log_failed", { rid: params.rid, message: learnErr.message });
      }
    } catch (e) {
      opsLog("growth_learning_log_failed", {
        rid: params.rid,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    ok: true,
    experimentId,
    improvedText,
    originalText,
    versionNumber: applied.versionNumber,
    measurement,
  };
}
