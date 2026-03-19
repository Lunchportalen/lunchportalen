import "server-only";

/**
 * Central suggest execution motor: one path for capability, context, tool selection,
 * provider selection, validation surface, logging surface, and fallback.
 * Consumed by POST /api/backoffice/ai/suggest only. Deterministic tools and
 * provider-backed inference run through the same execution contract.
 */

import { suggestJSON } from "@/lib/ai/provider";
import { getToolPolicy } from "@/lib/ai/tools/registry";
import { generateLandingPatch } from "@/lib/ai/tools/landingGenerateSections";
import { translateBlocksToPatch } from "@/lib/ai/tools/translateBlocks";
import { seoOptimizeToSuggestion } from "@/lib/ai/tools/seoOptimizePage";
import { contentMaintainToSuggestion } from "@/lib/ai/tools/contentMaintainPage";
import { generateAbVariants } from "@/lib/ai/tools/abGenerateVariants";
import { imageGenerateBrandSafe } from "@/lib/ai/tools/imageGenerateBrandSafe";
import { imageImproveMetadataToSuggestion } from "@/lib/ai/tools/imageImproveMetadata";
import { inputMetaToAiContext } from "@/lib/cms/model/pageAiContractHelpers";
import type { ToolId } from "@/lib/ai/tools/registry";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";

/** Raw request context from suggest route body. Motor parses and normalizes. */
export type SuggestMotorRequest = {
  tool: string;
  locale: "nb" | "en";
  input: Record<string, unknown>;
  /** Full body (o) for parsing blocks, existingBlocks, meta, pageId, variantId, pageTitle. */
  rawBody: Record<string, unknown>;
  environment: string;
  createdBy: string;
  /** Caller injects Supabase for tools that write (experiment, image generate). */
  getSupabase: () => { from: (table: string) => unknown };
};

/** Single suggestion path: motor returns data; route handles validation, insert, activity log. */
export type SuggestMotorResultSuggestion = {
  ok: true;
  kind: "suggestion";
  data: Record<string, unknown>;
  usage?: { promptTokens: number; completionTokens: number };
  model?: string;
  /** Failure-only field; optional here so callers can read `.error` on the union result. */
  error?: string;
};

/** Experiment path: motor performed inserts; route returns experimentId + suggestionIds. */
export type SuggestMotorResultExperiment = {
  ok: true;
  kind: "experiment";
  experimentId: string;
  suggestionIds: string[];
  error?: string;
};

/** Image candidates path: motor performed insert; route returns suggestionId + suggestion. */
export type SuggestMotorResultImageCandidates = {
  ok: true;
  kind: "image_candidates";
  suggestionId: string | null;
  data: Record<string, unknown>;
  error?: string;
};

/** Failure: route applies fallback or returns error. */
export type SuggestMotorResultFailure = {
  ok: false;
  error: string;
};

export type SuggestMotorResult =
  | SuggestMotorResultSuggestion
  | SuggestMotorResultExperiment
  | SuggestMotorResultImageCandidates
  | SuggestMotorResultFailure;

function parseBlocks(raw: unknown): Array<{ id: string; type: string; data?: Record<string, unknown> }> {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter((b): b is Record<string, unknown> => b != null && typeof b === "object" && typeof (b as { id?: unknown }).id === "string" && typeof (b as { type?: unknown }).type === "string")
    .map((b) => ({
      id: String((b as { id: string }).id),
      type: String((b as { type: string }).type),
      data: (b as { data?: unknown }).data && typeof (b as { data: unknown }).data === "object" && !Array.isArray((b as { data: unknown }).data) ? (b as { data: Record<string, unknown> }).data : {},
    }));
}

function parseExistingBlocks(raw: unknown): Array<{ id: string; type: string }> {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter((b): b is Record<string, unknown> => b != null && typeof b === "object" && typeof (b as { id?: unknown }).id === "string" && typeof (b as { type?: unknown }).type === "string")
    .map((b) => ({ id: String(b.id), type: String(b.type) }));
}

/**
 * Single entry: tool selection → context build → deterministic or provider execution →
 * normalized result (suggestion | experiment | image_candidates | failure).
 * Logging and fallback are applied by the route after this returns.
 */
export async function runSuggest(request: SuggestMotorRequest): Promise<SuggestMotorResult> {
  const { tool, locale, input, rawBody: o, environment: env, createdBy: email, getSupabase } = request;
  const policy = getToolPolicy(tool);
  if (!policy) return { ok: false, error: "UNKNOWN_TOOL" };

  const toolId = tool as ToolId;

  switch (toolId) {
    case "landing.generate.sections": {
      const existingBlocks = parseExistingBlocks(o.existingBlocks);
      const landingInput = {
        goal: typeof input.goal === "string" ? input.goal : "",
        audience: typeof input.audience === "string" ? input.audience : "",
        offerName: typeof input.offerName === "string" ? input.offerName : "Lunchportalen",
        proofPoints: Array.isArray(input.proofPoints) ? input.proofPoints : undefined,
        tone: (input.tone === "warm" || input.tone === "neutral" ? input.tone : "enterprise") as "enterprise" | "warm" | "neutral",
        locale,
      };
      const { summary, patch } = generateLandingPatch({ input: landingInput, existingBlocks });
      return { ok: true, kind: "suggestion", data: { summary, patch } };
    }

    case "i18n.translate.blocks": {
      const blocks = parseBlocks(o.blocks);
      const translateInput = {
        fromLocale: typeof input.fromLocale === "string" ? input.fromLocale : "nb",
        toLocale: typeof input.toLocale === "string" ? input.toLocale : "en",
        tone: (input.tone === "warm" || input.tone === "neutral" ? input.tone : "enterprise") as "enterprise" | "warm" | "neutral",
        mode: (input.mode === "strict" ? "strict" : "safe") as "safe" | "strict",
        locale,
      };
      const out = translateBlocksToPatch({ input: translateInput, blocks });
      return {
        ok: true,
        kind: "suggestion",
        data: out.patch ? { summary: out.summary, patch: out.patch, stats: out.stats } : { summary: out.summary, stats: out.stats },
      };
    }

    case "seo.optimize.page": {
      const blocks = parseBlocks(o.blocks);
      const meta = inputMetaToAiContext(input.meta);
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
      return { ok: true, kind: "suggestion", data: seoOut };
    }

    case "content.maintain.page": {
      const blocks = parseBlocks(o.blocks);
      const meta = inputMetaToAiContext(input.meta);
      const maintainInput = {
        locale,
        pageTitle: typeof input.pageTitle === "string" ? input.pageTitle : undefined,
        goal: (input.goal === "info" || input.goal === "signup" ? input.goal : "lead") as "lead" | "info" | "signup",
        brand: typeof input.brand === "string" ? input.brand : "Lunchportalen",
        mode: (input.mode === "strict" ? "strict" : "safe") as "safe" | "strict",
        maxOps: typeof input.maxOps === "number" ? Math.min(20, Math.max(1, input.maxOps)) : undefined,
      };
      const maintainOut = contentMaintainToSuggestion({ input: maintainInput, context: { blocks, meta } });
      return { ok: true, kind: "suggestion", data: maintainOut };
    }

    case "experiment.generate.variants": {
      const blocks = parseBlocks(o.blocks);
      const meta = o.meta && typeof o.meta === "object" && typeof (o.meta as Record<string, unknown>).description === "string" ? { description: (o.meta as { description: string }).description } : undefined;
      const pageTitle = typeof o.pageTitle === "string" ? o.pageTitle : typeof input.pageTitle === "string" ? input.pageTitle : undefined;
      const abInput = {
        locale,
        variantCount: (input.variantCount === 3 ? 3 : 2) as 2 | 3,
        target: (input.target === "hero_only" || input.target === "cta_only" ? input.target : "hero_cta") as "hero_cta" | "hero_only" | "cta_only",
        goal: (input.goal === "info" || input.goal === "signup" ? input.goal : "lead") as "lead" | "info" | "signup",
        brand: typeof input.brand === "string" ? input.brand : "Lunchportalen",
        mode: (input.mode === "strict" ? "strict" : "safe") as "safe" | "strict",
      };
      const { experimentId, variants } = generateAbVariants({ input: abInput, context: { blocks, meta, pageTitle } });
      for (const v of variants) {
        if (v.patch && typeof v.patch === "object" && "ops" in v.patch) {
          if (policy.patchAllowed !== true) return { ok: false, error: "PATCH_NOT_ALLOWED" };
          const p = v.patch as { version?: number; ops: unknown[] };
          if (p.version !== 1 || !Array.isArray(p.ops)) return { ok: false, error: "PATCH_INVALID" };
          if (policy.maxOps !== null && p.ops.length > policy.maxOps) return { ok: false, error: "PATCH_TOO_LARGE" };
        }
      }
      const supabase = getSupabase();
      const suggestionIds: string[] = [];
      for (const v of variants) {
        const output = {
          ...v.output,
          experiment: { ...v.output.experiment, id: experimentId },
          patch: v.patch,
          metaSuggestion: v.metaSuggestion,
        };
        const { data: inserted, error: insertErr } = await (supabase as { from: (t: string) => { insert: (r: unknown) => { select: (c: string) => { single: () => Promise<{ data: { id: string } | null; error: unknown }> } } } })
          .from("ai_suggestions")
          .insert({
            page_id: (o.pageId as string) ?? null,
            variant_id: (o.variantId as string) ?? null,
            environment: env,
            locale,
            tool,
            input: { ...input, locale, variantCount: abInput.variantCount, target: abInput.target, goal: abInput.goal, brand: abInput.brand, mode: abInput.mode },
            output,
            created_by: email,
          })
          .select("id")
          .single();
        if (!insertErr && inserted && typeof inserted.id === "string") suggestionIds.push(inserted.id);
      }
      const { error: activityLogErr } = await (supabase as { from: (t: string) => { insert: (r: unknown) => Promise<{ error: unknown }> } }).from("ai_activity_log").insert(
        buildAiActivityLogRow({
          action: "suggest",
          page_id: (o.pageId as string) ?? null,
          variant_id: (o.variantId as string) ?? null,
          actor_user_id: email,
          tool,
          environment: env,
          locale,
          metadata: { experimentId, suggestionIds, toolPolicy: { patchAllowed: policy.patchAllowed, maxOps: policy.maxOps, rateLimit: policy.rateLimit }, toolDocs: { title: policy.docs.title } },
        })
      );
      if (activityLogErr) return { ok: false, error: "SUGGESTION_LOG_FAILED" };
      return { ok: true, kind: "experiment", experimentId, suggestionIds };
    }

    case "image.generate.brand_safe": {
      const imgInput = {
        locale,
        purpose: (input.purpose === "section" || input.purpose === "social" ? input.purpose : "hero") as "hero" | "section" | "social",
        topic: typeof input.topic === "string" ? input.topic.trim() : "",
        brand: typeof input.brand === "string" ? input.brand : "Lunchportalen",
        style: input.style === "warm_enterprise" ? ("warm_enterprise" as const) : ("scandi_minimal" as const),
        count: input.count === 4 ? (4 as const) : (2 as const),
      };
      const imgOut = imageGenerateBrandSafe({ input: imgInput });
      const resultData = { summary: imgOut.summary, prompts: imgOut.prompts };
      const supabase = getSupabase();
      const insertResult = await (supabase as { from: (t: string) => { insert: (r: unknown) => { select: (c: string) => { single: () => Promise<{ data: { id: string } | null; error: unknown }> } } } })
        .from("ai_suggestions")
        .insert({
          page_id: (o.pageId as string) ?? null,
          variant_id: (o.variantId as string) ?? null,
          environment: env,
          locale,
          tool,
          input: { ...input, locale, purpose: imgInput.purpose, topic: imgInput.topic, brand: imgInput.brand, style: imgInput.style, count: imgInput.count },
          output: resultData,
          created_by: email,
        })
        .select("id")
        .single();
      const { data: inserted, error: insertErr } = insertResult;
      let suggestionId: string | null = null;
      if (!insertErr && inserted && typeof (inserted as { id: string }).id === "string") suggestionId = (inserted as { id: string }).id;
      const { error: imgActivityLogErr } = await (supabase as { from: (t: string) => { insert: (r: unknown) => Promise<{ error: unknown }> } }).from("ai_activity_log").insert(
        buildAiActivityLogRow({
          action: "suggest",
          page_id: (o.pageId as string) ?? null,
          variant_id: (o.variantId as string) ?? null,
          actor_user_id: email,
          tool,
          environment: env,
          locale,
          metadata: { tool, suggestionId, promptCount: imgOut.prompts.length, toolPolicy: { patchAllowed: policy.patchAllowed, maxOps: policy.maxOps, rateLimit: policy.rateLimit }, toolDocs: { title: policy.docs.title } },
        })
      );
      if (imgActivityLogErr) return { ok: false, error: "SUGGESTION_LOG_FAILED" };
      return { ok: true, kind: "image_candidates", suggestionId, data: resultData };
    }

    case "image.improve.metadata": {
      const mediaItemId = typeof input.mediaItemId === "string" ? input.mediaItemId.trim() : "";
      const url = typeof input.url === "string" ? input.url : "";
      const currentRaw = (input.current && typeof input.current === "object" && !Array.isArray(input.current) ? input.current : {}) as Record<string, unknown>;
      const current = {
        alt: typeof currentRaw.alt === "string" ? currentRaw.alt : "",
        caption: currentRaw.caption === null ? null : typeof currentRaw.caption === "string" ? currentRaw.caption : undefined,
        tags: Array.isArray(currentRaw.tags) ? (currentRaw.tags as unknown[]).filter((t): t is string => typeof t === "string") : [],
      };
      const contextRaw = (input.context && typeof input.context === "object" && !Array.isArray(input.context) ? input.context : {}) as Record<string, unknown>;
      const context = {
        pageTitle: typeof contextRaw.pageTitle === "string" ? contextRaw.pageTitle : undefined,
        topic: typeof contextRaw.topic === "string" ? contextRaw.topic : undefined,
        purpose: (contextRaw.purpose === "section" || contextRaw.purpose === "social" ? contextRaw.purpose : "hero") as "hero" | "section" | "social",
      };
      const improveInput = { locale, mediaItemId: mediaItemId || "unknown", url, current, context: Object.keys(context).length ? context : undefined, mode: (input.mode === "strict" ? "strict" : "safe") as "safe" | "strict" };
      const improveOut = imageImproveMetadataToSuggestion(improveInput);
      return { ok: true, kind: "suggestion", data: improveOut };
    }

    default: {
      const providerResult = await suggestJSON({ tool, locale, input });
      if (!providerResult.ok) return { ok: false, error: providerResult.error };
      return {
        ok: true,
        kind: "suggestion",
        data: providerResult.data,
        usage: providerResult.usage,
        model: providerResult.model,
      };
    }
  }
}
