/**
 * Batch: beregn forklarbar prediksjon per lead og skriv til meta (won/lost hoppes over).
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { verifyTable } from "@/lib/db/verifyTable";
import { resolvePipelineStage } from "@/lib/pipeline/dealNormalize";
import { extractFeatures } from "@/lib/pipeline/features";
import { predictOutcome } from "@/lib/pipeline/predictAdvanced";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "run_pipeline_prediction";
const MAX_LEADS = 6000;
const MAX_ACTIVITY = 8000;

export type RunPredictionResult = {
  ok: boolean;
  processed: number;
  skippedTerminal: number;
  skippedLocked: number;
  error?: string;
};

function isTerminalStage(stage: string): boolean {
  return stage === "won" || stage === "lost";
}

function isManualPredictionLock(meta: Record<string, unknown>): boolean {
  return meta.prediction_engine_locked === true;
}

export async function runPredictionEngine(supabase?: SupabaseClient): Promise<RunPredictionResult> {
  const client = supabase ?? (hasSupabaseAdminConfig() ? supabaseAdmin() : null);
  if (!client) {
    console.log("[PIPELINE_PREDICTION_SKIP]", { reason: "no_client" });
    return { ok: false, processed: 0, skippedTerminal: 0, skippedLocked: 0, error: "no_client" };
  }

  try {
    const lpOk = await verifyTable(client, "lead_pipeline", ROUTE);
    if (!lpOk) {
      console.log("[PIPELINE_PREDICTION_SKIP]", { reason: "lead_pipeline_unavailable" });
      return { ok: false, processed: 0, skippedTerminal: 0, skippedLocked: 0, error: "lead_pipeline_unavailable" };
    }

    const { data: leads, error: lErr } = await client
      .from("lead_pipeline")
      .select("id, created_at, status, meta, source_post_id")
      .limit(MAX_LEADS);

    if (lErr) {
      console.error("[PIPELINE_PREDICTION_LEADS]", lErr.message);
      return { ok: false, processed: 0, skippedTerminal: 0, skippedLocked: 0, error: lErr.message };
    }

    const leadRows = Array.isArray(leads) ? (leads as Record<string, unknown>[]) : [];
    if (leadRows.length === 0) {
      console.log("[PIPELINE_PREDICTION_SKIP]", { reason: "no_leads" });
      return { ok: true, processed: 0, skippedTerminal: 0, skippedLocked: 0 };
    }

    const { data: activity, error: aErr } = await client
      .from("ai_activity_log")
      .select("id, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(MAX_ACTIVITY);

    if (aErr) {
      console.error("[PIPELINE_PREDICTION_ACTIVITY]", aErr.message);
    }

    const activityRows = Array.isArray(activity) ? activity : [];

    const postIds = [
      ...new Set(
        leadRows
          .map((r) => (typeof r.source_post_id === "string" ? r.source_post_id.trim() : ""))
          .filter(Boolean),
      ),
    ];

    const postsById = new Map<string, { content?: unknown }>();
    if (postIds.length > 0) {
      const { data: posts, error: pErr } = await client.from("social_posts").select("id, content").in("id", postIds);
      if (pErr) {
        console.error("[PIPELINE_PREDICTION_POSTS]", pErr.message);
      } else if (Array.isArray(posts)) {
        for (const p of posts) {
          const o = p as { id?: string; content?: unknown };
          if (typeof o.id === "string" && o.id) postsById.set(o.id, { content: o.content });
        }
      }
    }

    let processed = 0;
    let skippedTerminal = 0;
    let skippedLocked = 0;

    for (const row of leadRows) {
      const id = typeof row.id === "string" ? row.id : "";
      if (!id) continue;

      const stage = resolvePipelineStage(row);
      if (isTerminalStage(stage)) {
        skippedTerminal++;
        continue;
      }

      const rawMeta = row.meta;
      const meta =
        rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
          ? { ...(rawMeta as Record<string, unknown>) }
          : {};

      if (isManualPredictionLock(meta)) {
        skippedLocked++;
        continue;
      }

      const features = extractFeatures(
        {
          id,
          created_at: typeof row.created_at === "string" ? row.created_at : undefined,
          source_post_id: typeof row.source_post_id === "string" ? row.source_post_id : null,
          meta,
        },
        activityRows as { created_at?: string | null; metadata?: Record<string, unknown> | null }[],
        postsById,
      );

      const prediction = predictOutcome(features, stage);

      const nextMeta = {
        ...meta,
        predicted_probability: prediction.probability,
        predicted_risk: prediction.risk,
        prediction_reasons: prediction.reasons,
        prediction_engine: {
          v: 1,
          model: "rules_v1",
          features: {
            age_days: Math.round(features.age_days * 100) / 100,
            days_since_last_activity: Math.round(features.days_since_last_activity * 100) / 100,
            activity_count: features.activity_count,
            clicks: features.clicks,
            orders_historical: features.orders_historical,
            stage,
          },
        },
      };

      const { error: upErr } = await client.from("lead_pipeline").update({ meta: nextMeta }).eq("id", id);
      if (upErr) {
        console.error("[PIPELINE_PREDICTION_UPDATE]", id, upErr.message);
        continue;
      }
      processed++;
    }

    console.log("[PIPELINE_PREDICTION_DONE]", { processed, skippedTerminal, skippedLocked, leadCount: leadRows.length });

    return { ok: true, processed, skippedTerminal, skippedLocked };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PIPELINE_PREDICTION_FATAL]", msg);
    return { ok: false, processed: 0, skippedTerminal: 0, skippedLocked: 0, error: msg };
  }
}
