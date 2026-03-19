/**
 * AI execution log: writes capability, timestamp, pageId, userId, resultStatus, latency to ai_activity_log.
 * Uses Supabase admin client; server-only. No silent drop: callers should handle insert failure.
 */

import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildAiActivityLogRow } from "./aiActivityLogRow";

export type AiExecutionLogParams = {
  /** Capability/tool name (stored as tool). */
  capability: string;
  /** Optional; defaults to now(). */
  timestamp?: string;
  /** Optional page id (page_id). */
  pageId?: string | null;
  /** Optional user identifier, e.g. email (created_by). */
  userId?: string | null;
  /** success | failure. */
  resultStatus: "success" | "failure";
  /** Latency in milliseconds (stored in metadata). */
  latency?: number | null;
  /** Environment: prod | staging | preview. Default preview. */
  environment?: "prod" | "staging" | "preview";
  /** Locale. Default nb. */
  locale?: "nb" | "en";
  /** Optional variant id (variant_id). */
  variantId?: string | null;
  /** Extra metadata (merged with resultStatus and latency). */
  metadata?: Record<string, unknown>;
};

/** Must match ai_activity_log_action_check in DB (see 20260404000000_ai_activity_log_actions_cms.sql). */
const ALLOWED_ACTIONS = [
  "suggest",
  "suggest_failed",
  "apply",
  "job_completed",
  "job_failed",
  "agent_run",
  "experiment_event",
  "editor_ai_metric",
  "design_suggestions_generated",
  "page_compose",
  "seo_intelligence_scored",
  "design_suggestion_applied",
  "text_improve",
  "cta_improve",
  "block_build",
  "image_prompts",
  "image_metadata",
] as const;

export type AiExecutionLogResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Writes an AI execution log row to ai_activity_log.
 * Maps: capability -> tool, timestamp -> created_at, pageId -> page_id, userId -> created_by,
 * resultStatus + latency -> metadata. Environment and locale default to preview and nb.
 */
export async function logAiExecution(
  params: AiExecutionLogParams
): Promise<AiExecutionLogResult> {
  const capability = typeof params.capability === "string" ? params.capability.trim() : "";
  if (!capability) {
    return { ok: false, error: "capability is required" };
  }

  const resultStatus = params.resultStatus === "failure" ? "failure" : "success";
  const environment =
    params.environment === "prod"
      ? "prod"
      : params.environment === "staging"
        ? "staging"
        : "preview";
  const locale = params.locale === "en" ? "en" : "nb";

  const metadata: Record<string, unknown> = {
    resultStatus,
    ...(typeof params.latency === "number" && !Number.isNaN(params.latency) && { latencyMs: params.latency }),
    ...(params.metadata && typeof params.metadata === "object" && !Array.isArray(params.metadata)
      ? params.metadata
      : {}),
  };

  const row = buildAiActivityLogRow({
    action: "suggest",
    page_id: params.pageId ?? null,
    variant_id: params.variantId ?? null,
    actor_user_id: params.userId ?? null,
    tool: capability,
    environment,
    locale,
    metadata,
  });

  try {
    const supabase = supabaseAdmin();
    const insertPayload =
      params.timestamp != null && typeof params.timestamp === "string" && params.timestamp.trim()
        ? { ...row, created_at: params.timestamp.trim() }
        : row;
    const { error } = await supabase.from("ai_activity_log").insert(insertPayload as Record<string, unknown>);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

export { ALLOWED_ACTIONS };
