import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { isAIEnabled, suggestJSON } from "@/lib/ai/provider";
import { generateLandingPatch } from "@/lib/ai/tools/landingGenerateSections";
import { translateBlocksToPatch } from "@/lib/ai/tools/translateBlocks";
import { seoOptimizeToSuggestion } from "@/lib/ai/tools/seoOptimizePage";
import { contentMaintainToSuggestion } from "@/lib/ai/tools/contentMaintainPage";
import { generateAbVariants } from "@/lib/ai/tools/abGenerateVariants";
import { imageGenerateBrandSafe } from "@/lib/ai/tools/imageGenerateBrandSafe";
import { imageImproveMetadataToSuggestion } from "@/lib/ai/tools/imageImproveMetadata";
import { getToolPolicy } from "@/lib/ai/tools/registry";

const rateLimitMap = new Map<string, { count: number; ts: number }>();

function rateLimitOk(key: string, windowMs: number, max: number): boolean {
  if (max <= 0) return true;
  const now = Date.now();
  const b = rateLimitMap.get(key);
  if (!b || now - b.ts > windowMs) {
    rateLimitMap.set(key, { count: 1, ts: now });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  if (!isAIEnabled()) {
    return jsonErr(ctx.rid, "AI is disabled.", 503, "FEATURE_DISABLED");
  }

  const email = ctx.scope?.email ?? "anon";
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");

  const environment =
    o.environment === "staging" ? "staging" : o.environment === "preview" ? "preview" : "prod";
  const env = o.env === "staging" ? "staging" : o.env === "preview" ? "preview" : environment;
  const locale = o.locale === "en" ? "en" : "nb";
  const tool = typeof o.tool === "string" ? o.tool.trim() : "";
  const input = o.input && typeof o.input === "object" ? (o.input as Record<string, unknown>) : {};
  if (!tool) return jsonErr(ctx.rid, "Mangler tool.", 400, "BAD_REQUEST");

  const policy = getToolPolicy(tool);
  if (!policy) return jsonErr(ctx.rid, "Unknown AI tool.", 400, "UNKNOWN_TOOL");
  if (policy.role !== "superadmin") return jsonErr(ctx.rid, "Tool not allowed for this role.", 403, "TOOL_FORBIDDEN");
  if (policy.rateLimit !== null) {
    const rlKey = `${email}:${tool}`;
    const windowMs = policy.rateLimit.windowSeconds * 1000;
    if (!rateLimitOk(rlKey, windowMs, policy.rateLimit.max)) {
      return jsonErr(ctx.rid, "Rate limit exceeded.", 429, "RATE_LIMIT");
    }
  }

  let result: { ok: true; data: Record<string, unknown>; usage?: { promptTokens: number; completionTokens: number }; model?: string } | { ok: false; error: string };
  if (tool === "landing.generate.sections") {
    const existingBlocksRaw = o.existingBlocks;
    const existingBlocks = Array.isArray(existingBlocksRaw)
      ? (existingBlocksRaw as unknown[])
          .filter((b): b is { id: string; type: string } => b != null && typeof b === "object" && typeof (b as { id?: unknown }).id === "string" && typeof (b as { type?: unknown }).type === "string")
          .map((b) => ({ id: String(b.id), type: String(b.type) }))
      : [];
    const landingInput = {
      goal: typeof input.goal === "string" ? input.goal : "",
      audience: typeof input.audience === "string" ? input.audience : "",
      offerName: typeof input.offerName === "string" ? input.offerName : "Lunchportalen",
      proofPoints: Array.isArray(input.proofPoints) ? input.proofPoints : undefined,
      tone: (input.tone === "warm" || input.tone === "neutral" ? input.tone : "enterprise") as "enterprise" | "warm" | "neutral",
      locale,
    };
    const { summary, patch } = generateLandingPatch({ input: landingInput, existingBlocks });
    result = { ok: true, data: { summary, patch } };
  } else if (tool === "i18n.translate.blocks") {
    const blocksRaw = o.blocks;
    const blocks = Array.isArray(blocksRaw)
      ? (blocksRaw as unknown[])
          .filter((b): b is { id: string; type: string; data?: Record<string, unknown> } => b != null && typeof b === "object" && typeof (b as { id?: unknown }).id === "string" && typeof (b as { type?: unknown }).type === "string")
          .map((b) => ({ id: String((b as { id: string }).id), type: String((b as { type: string }).type), data: (b as { data?: Record<string, unknown> }).data && typeof (b as { data: unknown }).data === "object" && !Array.isArray((b as { data: unknown }).data) ? (b as { data: Record<string, unknown> }).data : {} }))
      : [];
    const translateInput = {
      fromLocale: typeof input.fromLocale === "string" ? input.fromLocale : "nb",
      toLocale: typeof input.toLocale === "string" ? input.toLocale : "en",
      tone: (input.tone === "warm" || input.tone === "neutral" ? input.tone : "enterprise") as "enterprise" | "warm" | "neutral",
      mode: (input.mode === "strict" ? "strict" : "safe") as "safe" | "strict",
      locale,
    };
    const out = translateBlocksToPatch({ input: translateInput, blocks });
    result = { ok: true, data: out.patch ? { summary: out.summary, patch: out.patch, stats: out.stats } : { summary: out.summary, stats: out.stats } };
  } else if (tool === "seo.optimize.page") {
    const blocksRaw = o.blocks;
    const blocks = Array.isArray(blocksRaw)
      ? (blocksRaw as unknown[])
          .filter((b): b is { id: string; type: string; data?: Record<string, unknown> } => b != null && typeof b === "object" && typeof (b as { id?: unknown }).id === "string" && typeof (b as { type?: unknown }).type === "string")
          .map((b) => ({ id: String((b as { id: string }).id), type: String((b as { type: string }).type), data: (b as { data?: unknown }).data && typeof (b as { data: unknown }).data === "object" && !Array.isArray((b as { data: unknown }).data) ? (b as { data: Record<string, unknown> }).data : {} }))
      : [];
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
    result = { ok: true, data: seoOut };
  } else if (tool === "content.maintain.page") {
    const blocksRaw = o.blocks;
    const blocks = Array.isArray(blocksRaw)
      ? (blocksRaw as unknown[])
          .filter((b): b is { id: string; type: string; data?: Record<string, unknown> } => b != null && typeof b === "object" && typeof (b as { id?: unknown }).id === "string" && typeof (b as { type?: unknown }).type === "string")
          .map((b) => ({ id: String((b as { id: string }).id), type: String((b as { type: string }).type), data: (b as { data?: unknown }).data && typeof (b as { data: unknown }).data === "object" && !Array.isArray((b as { data: unknown }).data) ? (b as { data: Record<string, unknown> }).data : {} }))
      : [];
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
    result = { ok: true, data: maintainOut };
  } else if (tool === "experiment.generate.variants") {
    const blocksRaw = o.blocks;
    const blocks = Array.isArray(blocksRaw)
      ? (blocksRaw as unknown[])
          .filter((b): b is { id: string; type: string; data?: Record<string, unknown> } => b != null && typeof b === "object" && typeof (b as { id?: unknown }).id === "string" && typeof (b as { type?: unknown }).type === "string")
          .map((b) => ({ id: String((b as { id: string }).id), type: String((b as { type: string }).type), data: (b as { data?: unknown }).data && typeof (b as { data: unknown }).data === "object" && !Array.isArray((b as { data: unknown }).data) ? (b as { data: Record<string, unknown> }).data : {} }))
      : [];
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
        if (policy.patchAllowed !== true) return jsonErr(ctx.rid, "Tool may not output patch.", 400, "PATCH_NOT_ALLOWED");
        const p = v.patch as { version?: number; ops: unknown[] };
        if (p.version !== 1 || !Array.isArray(p.ops)) return jsonErr(ctx.rid, "Invalid patch shape.", 400, "PATCH_INVALID");
        if (policy.maxOps !== null && p.ops.length > policy.maxOps) return jsonErr(ctx.rid, "Patch exceeds maxOps.", 400, "PATCH_TOO_LARGE");
      }
    }
    const suggestionIds: string[] = [];
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    for (const v of variants) {
      const output = {
        ...v.output,
        experiment: { ...v.output.experiment, id: experimentId },
        patch: v.patch,
        metaSuggestion: v.metaSuggestion,
      };
      const { data: inserted, error: insertErr } = await supabase
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
    await supabase.from("ai_activity_log").insert({
      page_id: (o.pageId as string) ?? null,
      variant_id: (o.variantId as string) ?? null,
      environment: env,
      locale,
      action: "suggest",
      tool,
      created_by: email,
      metadata: { experimentId, suggestionIds, toolPolicy: { patchAllowed: policy.patchAllowed, maxOps: policy.maxOps, rateLimit: policy.rateLimit }, toolDocs: { title: policy.docs.title } },
    });
    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, experimentId, suggestionIds }, 200);
  } else if (tool === "image.generate.brand_safe") {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const imgInput = {
      locale,
      purpose: (input.purpose === "section" || input.purpose === "social" ? input.purpose : "hero") as "hero" | "section" | "social",
      topic: typeof input.topic === "string" ? input.topic.trim() : "",
      brand: typeof input.brand === "string" ? input.brand : "Lunchportalen",
      style: input.style === "warm_enterprise" ? "warm_enterprise" as const : "scandi_minimal" as const,
      count: input.count === 4 ? 4 as const : 2 as const,
    };
    const imgOut = await imageGenerateBrandSafe({ input: imgInput, supabase, createdBy: email });
    const resultData = { summary: imgOut.summary, candidates: imgOut.candidates };
    let suggestionId: string | null = null;
    const { data: inserted, error: insertErr } = await supabase
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
    if (!insertErr && inserted && typeof (inserted as { id: string }).id === "string") suggestionId = (inserted as { id: string }).id;
    await supabase.from("ai_activity_log").insert({
      page_id: (o.pageId as string) ?? null,
      variant_id: (o.variantId as string) ?? null,
      environment: env,
      locale,
      action: "suggest",
      tool,
      created_by: email,
      metadata: { tool, suggestionId, candidateCount: imgOut.candidates.length, mediaItemIds: imgOut.candidates.map((c) => c.mediaItemId), toolPolicy: { patchAllowed: policy.patchAllowed, maxOps: policy.maxOps, rateLimit: policy.rateLimit }, toolDocs: { title: policy.docs.title } },
    });
    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, suggestionId, suggestion: resultData }, 200);
  } else if (tool === "image.improve.metadata") {
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
    result = { ok: true, data: improveOut };
  } else {
    result = await suggestJSON({ tool, locale, input });
  }

  if (!result.ok) {
    const err = (result as { ok: false; error: string }).error;
    if (err === "AI_DISABLED") {
      return jsonErr(ctx.rid, "AI is disabled.", 503, "FEATURE_DISABLED");
    }
    return jsonErr(ctx.rid, "AI suggestion failed.", 500, "AI_FAILED");
  }

  const data = result.data;
  if (data && typeof data === "object" && "patch" in data) {
    const patch = (data as { patch?: unknown }).patch;
    if (patch !== null && typeof patch === "object" && "version" in patch && "ops" in patch) {
      if (policy.patchAllowed !== true) {
        return jsonErr(ctx.rid, "Tool may not output patch.", 400, "PATCH_NOT_ALLOWED");
      }
      const p = patch as { version: number; ops: unknown[] };
      if (p.version !== 1 || !Array.isArray(p.ops)) {
        return jsonErr(ctx.rid, "Invalid patch shape.", 400, "PATCH_INVALID");
      }
      if (policy.maxOps !== null && p.ops.length > policy.maxOps) {
        return jsonErr(ctx.rid, "Patch exceeds maxOps.", 400, "PATCH_TOO_LARGE");
      }
    }
  }

  let suggestionId: string | null = null;

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { data: inserted, error: insertErr } = await supabase
      .from("ai_suggestions")
      .insert({
        page_id: (o.pageId as string) ?? null,
        variant_id: (o.variantId as string) ?? null,
        environment: env,
        locale,
        tool,
        input,
        output: result.data,
        created_by: email,
      })
      .select("id")
      .single();

    if (insertErr) {
      // best-effort: log error but do not fail request
    } else if (inserted && typeof inserted.id === "string") {
      suggestionId = inserted.id;
    }

    await supabase.from("ai_activity_log").insert({
      page_id: (o.pageId as string) ?? null,
      variant_id: (o.variantId as string) ?? null,
      environment: env,
      locale,
      action: "suggest",
      tool,
      prompt_tokens: result.usage?.promptTokens ?? null,
      completion_tokens: result.usage?.completionTokens ?? null,
      model: result.model ?? null,
      created_by: email,
      metadata: {
        inputKeys: Object.keys(input).slice(0, 20),
        suggestionId,
        toolPolicy: { patchAllowed: policy.patchAllowed, maxOps: policy.maxOps, rateLimit: policy.rateLimit },
        toolDocs: { title: policy.docs.title },
      },
    });
  } catch (_) {
    // best-effort log
  }

  return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, suggestionId, suggestion: result.data }, 200);
}
