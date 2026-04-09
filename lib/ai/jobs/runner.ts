// DUPLICATE — review

/**
 * AI jobs runner: process pending ai_jobs with claim, retries, and backoff (Phase 43A).
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";
import { claimPendingJobs } from "@/lib/ai/jobs/claim";
import { computeBackoffSeconds } from "@/lib/ai/jobs/backoff";
import { generateLandingPatch } from "@/lib/ai/tools/landingGenerateSections";
import { translateBlocksToPatch } from "@/lib/ai/tools/translateBlocks";
import { seoOptimizeToSuggestion } from "@/lib/ai/tools/seoOptimizePage";
import { contentMaintainToSuggestion } from "@/lib/ai/tools/contentMaintainPage";
import { imageImproveMetadataToSuggestion } from "@/lib/ai/tools/imageImproveMetadata";

export type AiJobRow = {
  id: string;
  tool: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

function normalizeBlocks(
  raw: unknown
): Array<{ id: string; type: string; data?: Record<string, unknown> }> {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter(
      (b): b is { id: string; type: string; data?: Record<string, unknown> } =>
        b != null &&
        typeof b === "object" &&
        typeof (b as { id?: unknown }).id === "string" &&
        typeof (b as { type?: unknown }).type === "string"
    )
    .map((b) => ({
      id: String(b.id),
      type: String(b.type),
      data:
        (b as { data?: unknown }).data &&
        typeof (b as { data: unknown }).data === "object" &&
        !Array.isArray((b as { data: unknown }).data)
          ? (b as { data: Record<string, unknown> }).data
          : {},
    }));
}

function normalizeExistingBlocks(raw: unknown): Array<{ id: string; type: string }> {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter(
      (b): b is { id: string; type: string } =>
        b != null &&
        typeof b === "object" &&
        typeof (b as { id?: unknown }).id === "string" &&
        typeof (b as { type?: unknown }).type === "string"
    )
    .map((b) => ({ id: String(b.id), type: String(b.type) }));
}

function executeTool(
  tool: string,
  input: Record<string, unknown>,
  _createdBy: string
): Record<string, unknown> {
  const locale = typeof input.locale === "string" ? input.locale : "nb";
  switch (tool) {
    case "landing.generate.sections": {
      const existingBlocks = normalizeExistingBlocks(input.existingBlocks ?? []);
      const landingInput = {
        goal: typeof input.goal === "string" ? input.goal : "",
        audience: typeof input.audience === "string" ? input.audience : "",
        offerName: typeof input.offerName === "string" ? input.offerName : "Lunchportalen",
        proofPoints: Array.isArray(input.proofPoints) ? input.proofPoints : undefined,
        tone: (input.tone === "warm" || input.tone === "neutral" ? input.tone : "enterprise") as "enterprise" | "warm" | "neutral",
        locale,
      };
      const { summary, patch } = generateLandingPatch({ input: landingInput, existingBlocks });
      return { summary, patch };
    }
    case "i18n.translate.blocks": {
      const blocks = normalizeBlocks(input.blocks ?? []);
      const translateInput = {
        fromLocale: typeof input.fromLocale === "string" ? input.fromLocale : "nb",
        toLocale: typeof input.toLocale === "string" ? input.toLocale : "en",
        tone: (input.tone === "warm" || input.tone === "neutral" ? input.tone : "enterprise") as "enterprise" | "warm" | "neutral",
        mode: (input.mode === "strict" ? "strict" : "safe") as "safe" | "strict",
        locale,
      };
      const out = translateBlocksToPatch({ input: translateInput, blocks });
      return out.patch ? { summary: out.summary, patch: out.patch, stats: out.stats } : { summary: out.summary, stats: out.stats };
    }
    case "seo.optimize.page": {
      const blocks = normalizeBlocks(input.blocks ?? []);
      const inputMeta = input.meta && typeof input.meta === "object" && !Array.isArray(input.meta) ? (input.meta as Record<string, unknown>) : {};
      const meta = typeof inputMeta.description === "string" ? { description: inputMeta.description } : undefined;
      const seoInput = {
        locale,
        pageTitle: typeof input.pageTitle === "string" ? input.pageTitle : undefined,
        pageSlug: typeof input.pageSlug === "string" ? input.pageSlug : undefined,
        goal: (input.goal === "info" || input.goal === "signup" ? input.goal : "lead") as "lead" | "info" | "signup",
        audience: typeof input.audience === "string" ? input.audience : undefined,
        brand: typeof input.brand === "string" ? input.brand : "Lunchportalen",
        mode: (input.mode === "strict" ? "strict" : "safe") as "safe" | "strict",
      };
      const seoOut = seoOptimizeToSuggestion({ input: seoInput, context: { blocks, meta } });
      return seoOut as unknown as Record<string, unknown>;
    }
    case "content.maintain.page": {
      const blocks = normalizeBlocks(input.blocks ?? []);
      const inputMeta = input.meta && typeof input.meta === "object" && !Array.isArray(input.meta) ? (input.meta as Record<string, unknown>) : {};
      const meta = typeof inputMeta.description === "string" ? { description: inputMeta.description } : undefined;
      const maintainInput = {
        locale,
        pageTitle: typeof input.pageTitle === "string" ? input.pageTitle : undefined,
        goal: (input.goal === "info" || input.goal === "signup" ? input.goal : "lead") as "lead" | "info" | "signup",
        brand: typeof input.brand === "string" ? input.brand : "Lunchportalen",
        mode: (input.mode === "strict" ? "strict" : "safe") as "safe" | "strict",
        maxOps: typeof input.maxOps === "number" ? Math.min(20, Math.max(1, input.maxOps)) : undefined,
      };
      const maintainOut = contentMaintainToSuggestion({ input: maintainInput, context: { blocks, meta } });
      return maintainOut as unknown as Record<string, unknown>;
    }
    case "image.improve.metadata": {
      const currentRaw = input.current && typeof input.current === "object" && !Array.isArray(input.current) ? (input.current as Record<string, unknown>) : {};
      const current = {
        alt: typeof currentRaw.alt === "string" ? currentRaw.alt : "",
        caption: currentRaw.caption === null ? null : typeof currentRaw.caption === "string" ? currentRaw.caption : undefined,
        tags: Array.isArray(currentRaw.tags) ? (currentRaw.tags).filter((t) => typeof t === "string") : [],
      };
      const contextRaw = input.context && typeof input.context === "object" && !Array.isArray(input.context) ? (input.context as Record<string, unknown>) : {};
      const context = {
        pageTitle: typeof contextRaw.pageTitle === "string" ? contextRaw.pageTitle : undefined,
        topic: typeof contextRaw.topic === "string" ? contextRaw.topic : undefined,
        purpose: (contextRaw.purpose === "section" || contextRaw.purpose === "social" ? contextRaw.purpose : "hero") as "hero" | "section" | "social",
      };
      const improveInput = {
        locale,
        mediaItemId: typeof input.mediaItemId === "string" ? input.mediaItemId.trim() : "unknown",
        url: typeof input.url === "string" ? input.url : "",
        current,
        context: Object.keys(context).length ? context : undefined,
        mode: (input.mode === "strict" ? "strict" : "safe") as "safe" | "strict",
      };
      const improveOut = imageImproveMetadataToSuggestion(improveInput);
      return improveOut as unknown as Record<string, unknown>;
    }
    default:
      throw new Error("Tool not supported for async");
  }
}

export async function runPendingJobs(): Promise<{ ran: number; completed: number; failed: number }> {
  const supabase = supabaseAdmin();
  const runnerId = `runner_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const claimed = await claimPendingJobs(supabase, { limit: 10, runnerId });
  let completed = 0, failed = 0;
  const createdBy = "system";
  for (const job of claimed) {
    const jobId = job.id;
    const tool = job.tool;
    const input = job.input;
    const createdByUser = job.created_by ?? createdBy;
    const attempts = job.attempts;
    const maxAttempts = job.max_attempts;
    try {
      const output = executeTool(tool, input, createdByUser);
      await supabase.from("ai_jobs").update({
        output,
        status: "completed",
        finished_at: new Date().toISOString(),
        locked_by: null,
        locked_at: null,
      }).eq("id", jobId);
      await supabase.from("ai_activity_log").insert({
        page_id: null, variant_id: null, environment: "preview", locale: "nb",
        action: "job_completed", tool, metadata: { jobId, tool },
      });
      completed += 1;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const nextAttempts = attempts + 1;
      if (nextAttempts >= maxAttempts) {
        await supabase.from("ai_jobs").update({
          status: "failed",
          error: errorMessage,
          finished_at: new Date().toISOString(),
          attempts: nextAttempts,
          locked_by: null,
          locked_at: null,
        }).eq("id", jobId);
      } else {
        const backoffSec = computeBackoffSeconds(nextAttempts);
        const nextRunAt = new Date(Date.now() + backoffSec * 1000).toISOString();
        await supabase.from("ai_jobs").update({
          status: "pending",
          error: errorMessage,
          attempts: nextAttempts,
          next_run_at: nextRunAt,
          locked_by: null,
          locked_at: null,
        }).eq("id", jobId);
      }
      const { buildAiActivityLogRow } = await import("@/lib/ai/logging/aiActivityLogRow");
      const { error: logErr } = await supabase.from("ai_activity_log").insert(
        buildAiActivityLogRow({
          action: "job_failed",
          page_id: null,
          variant_id: null,
          tool,
          environment: "preview",
          locale: "nb",
          metadata: { jobId, tool, error: errorMessage, attempts: nextAttempts },
        })
      );
      if (logErr) opsLog("ai_activity_log.insert_failed", { context: "job_runner", action: "job_failed", tool, jobId, error: logErr.message });
      failed += 1;
    }
  }
  return { ran: claimed.length, completed, failed };
}
