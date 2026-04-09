// STATUS: KEEP

/**
 * AI memory outcome recording: best-effort writes to ai_memory for learning.
 * Used by apply, publish, release, SEO flows. Never throws; failures are opsLogged.
 * Server-only; requires supabase client with RLS (e.g. supabaseAdmin).
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertAiMemory } from "./aiMemory";

const PAYLOAD_MAX_KEYS = 24;
function truncatePayload(obj: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(obj);
  if (keys.length <= PAYLOAD_MAX_KEYS) return obj;
  const out: Record<string, unknown> = {};
  for (let i = 0; i < PAYLOAD_MAX_KEYS; i++) out[keys[i]!] = obj[keys[i]!];
  out._truncated = true;
  return out;
}

export type RecordSuggestionAppliedOpts = {
  pageId?: string | null;
  variantId?: string | null;
  companyId?: string | null;
  tool: string;
  appliedKeys?: string[];
  sourceRid?: string | null;
};

/** Record that a user applied an AI suggestion (feeds learning: what gets applied). */
export async function recordSuggestionApplied(supabase: SupabaseClient, opts: RecordSuggestionAppliedOpts): Promise<void> {
  try {
    const payload = truncatePayload({
      worked: true,
      area: "suggestion_applied",
      tool: opts.tool?.slice(0, 64) ?? "apply",
      pageId: opts.pageId ?? undefined,
      variantId: opts.variantId ?? undefined,
      appliedKeys: Array.isArray(opts.appliedKeys) ? opts.appliedKeys.slice(0, 20) : undefined,
    });
    await insertAiMemory(supabase, {
      kind: "outcome",
      payload,
      page_id: opts.pageId ?? undefined,
      company_id: opts.companyId ?? undefined,
      source_rid: opts.sourceRid ?? undefined,
    });
  } catch (e) {
    const { opsLog } = await import("@/lib/ops/log");
    opsLog("ai_memory.record_suggestion_applied_failed", { error: e instanceof Error ? e.message : String(e) });
  }
}

export type RecordContentPublishedOpts = {
  pageId: string;
  variantId: string;
  env: "prod" | "staging";
  sourceRid?: string | null;
};

/** Record that content was published (feeds learning: what gets published). */
export async function recordContentPublished(supabase: SupabaseClient, opts: RecordContentPublishedOpts): Promise<void> {
  try {
    const payload = truncatePayload({
      worked: true,
      area: "content_published",
      pageId: opts.pageId,
      variantId: opts.variantId,
      env: opts.env,
    });
    await insertAiMemory(supabase, {
      kind: "outcome",
      payload,
      page_id: opts.pageId,
      source_rid: opts.sourceRid ?? undefined,
    });
  } catch (e) {
    const { opsLog } = await import("@/lib/ops/log");
    opsLog("ai_memory.record_content_published_failed", { error: e instanceof Error ? e.message : String(e) });
  }
}

export type RecordReleaseExecutedOpts = {
  releaseId: string;
  count: number;
  sourceRid?: string | null;
};

/** Record that a release was executed (feeds learning: bulk publish outcomes). */
export async function recordReleaseExecuted(supabase: SupabaseClient, opts: RecordReleaseExecutedOpts): Promise<void> {
  try {
    const payload = truncatePayload({
      worked: true,
      area: "release_executed",
      releaseId: opts.releaseId,
      count: opts.count,
    });
    await insertAiMemory(supabase, {
      kind: "outcome",
      payload,
      source_rid: opts.sourceRid ?? undefined,
    });
  } catch (e) {
    const { opsLog } = await import("@/lib/ops/log");
    opsLog("ai_memory.record_release_executed_failed", { error: e instanceof Error ? e.message : String(e) });
  }
}

export type RecordSeoLearningOpts = {
  pageId?: string | null;
  score: number;
  suggestionCount: number;
  sourceRid?: string | null;
};

/** Record SEO intelligence result (feeds learning: SEO scores over time). */
export async function recordSeoLearning(supabase: SupabaseClient, opts: RecordSeoLearningOpts): Promise<void> {
  try {
    const payload = truncatePayload({
      score: opts.score,
      suggestionCount: opts.suggestionCount,
      pageId: opts.pageId ?? undefined,
    });
    await insertAiMemory(supabase, {
      kind: "seo_learning",
      payload,
      page_id: opts.pageId ?? undefined,
      source_rid: opts.sourceRid ?? undefined,
    });
  } catch (e) {
    const { opsLog } = await import("@/lib/ops/log");
    opsLog("ai_memory.record_seo_learning_failed", { error: e instanceof Error ? e.message : String(e) });
  }
}
