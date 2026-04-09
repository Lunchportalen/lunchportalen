/**
 * POST /api/backoffice/ai/image-generator
 * Prompt-suggestion only: returns prompts and alt text for brand-safe images. No image generation, no placeholder URLs.
 * Request: { prompt?, topic?, purpose?, locale?, style?, brand? }
 * Response: { message, revisedPrompt, prompts: [{ prompt, alt }], purpose, topic }.
 */
import type { NextRequest } from "next/server";
import { AI_RUNNER_TOOL, AiRunnerError, isAIEnabled, runAi } from "@/lib/ai/runner";
import { imageGenerateBrandSafe } from "@/lib/ai/tools/imageGenerateBrandSafe";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { logActivity } from "@/lib/ai/logActivity";
import { supabaseAdmin, hasSupabaseAdminConfig } from "@/lib/supabase/admin";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getMediaBucket(): string {
  const fromEnv = process.env.MEDIA_STORAGE_BUCKET;
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  return "media";
}

function sanitizeFileName(name: string | null | undefined): string {
  const fallback = "ai-generated";
  if (!name || typeof name !== "string") return fallback;
  const base = (name.trim().split(/[\\/]/).pop() || fallback).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base || fallback;
}

export async function POST(req: NextRequest) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;
  const ctx = gate.ctx;
  const start = Date.now();
  const logImg = (status: "success" | "error", meta?: Record<string, unknown>) => {
    const duration = Date.now() - start;
    logActivity({
      rid: ctx.rid,
      action: "image",
      status,
      duration,
      actorUserId: ctx.scope?.email ?? null,
      metadataExtra: { route: "api/backoffice/ai/image-generator", ...meta },
    });
  };

  if (!isAIEnabled()) {
    logImg("error", { code: "FEATURE_DISABLED" });
    return jsonErr(ctx.rid, "AI is disabled.", 503, "FEATURE_DISABLED");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logImg("error", { code: "BAD_REQUEST", phase: "json" });
    return jsonErr(ctx.rid, "Invalid JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) {
    logImg("error", { code: "BAD_REQUEST", phase: "body_shape" });
    return jsonErr(ctx.rid, "Body must be an object.", 400, "BAD_REQUEST");
  }

  const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
  const topic = typeof o.topic === "string" ? o.topic.trim() : "";
  const purpose = (o.purpose === "section" || o.purpose === "social" ? o.purpose : "hero") as "hero" | "section" | "social";
  const hasPrompt = prompt.length > 0;
  const hasTopicAndPurpose = topic.length > 0;
  if (!hasPrompt && !hasTopicAndPurpose) {
    logImg("error", { code: "MISSING_INPUT" });
    return jsonErr(ctx.rid, "Missing prompt and (topic + purpose); provide prompt or both topic and purpose.", 400, "MISSING_INPUT");
  }

  const locale = o.locale === "en" ? "en" : "nb";
  const style = o.style === "warm_enterprise" ? ("warm_enterprise" as const) : ("scandi_minimal" as const);
  const topicForTool = hasPrompt ? prompt : topic;
  const brand = typeof o.brand === "string" ? o.brand.trim() : "Lunchportalen";
  const generateAndStore = o.generate === true;

  if (generateAndStore) {
    if (!hasPrompt) {
      logImg("error", { code: "MISSING_PROMPT", mode: "generate" });
      return jsonErr(ctx.rid, "Missing prompt for image generation.", 400, "MISSING_PROMPT");
    }
    if (!hasSupabaseAdminConfig()) {
      logImg("error", { code: "MEDIA_UPLOAD_CONFIG_MISSING", mode: "generate" });
      return jsonErr(ctx.rid, "Supabase admin-konfigurasjon mangler.", 500, "MEDIA_UPLOAD_CONFIG_MISSING");
    }

    const envPlatformCompany =
      typeof process.env.CMS_AI_DEFAULT_COMPANY_ID === "string" ? process.env.CMS_AI_DEFAULT_COMPANY_ID.trim() : "";
    const companyId = (ctx.scope?.companyId ?? "").trim() || envPlatformCompany;
    const userId = (ctx.scope?.userId ?? ctx.scope?.sub ?? ctx.scope?.email ?? "").trim();
    if (!companyId || !userId) {
      logImg("error", { code: "MISSING_CONTEXT", mode: "generate" });
      return jsonErr(ctx.rid, "Mangler company_id/userId for bildegenerering.", 422, "MISSING_CONTEXT");
    }

    try {
      const { result: imageResult } = await runAi({
        companyId,
        userId,
        tool: AI_RUNNER_TOOL.OPENAI_IMAGES,
        input: {
          openaiBody: {
            model: "gpt-image-1",
            prompt,
            response_format: "b64_json",
          },
        },
      });
      const imageJson = imageResult as { data?: Array<{ b64_json?: string; url?: string }> } | null;

      const b64 = imageJson?.data?.[0]?.b64_json;
      if (!b64 || typeof b64 !== "string") {
        logImg("error", { code: "IMAGE_GENERATION_EMPTY", mode: "generate", phase: "b64" });
        return jsonErr(ctx.rid, "Image generation returned no binary.", 500, "IMAGE_GENERATION_EMPTY");
      }

      const binary = Buffer.from(b64, "base64");
      if (!binary || binary.length === 0) {
        logImg("error", { code: "IMAGE_GENERATION_EMPTY", mode: "generate", phase: "buffer" });
        return jsonErr(ctx.rid, "Generated image was empty.", 500, "IMAGE_GENERATION_EMPTY");
      }

      const now = new Date();
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, "0");
      const d = String(now.getUTCDate()).padStart(2, "0");
      const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
      const fileBase = sanitizeFileName("ai-generated");
      const objectPath = `ai/${y}/${m}/${d}/${fileBase}-${rand}.png`;
      const bucket = getMediaBucket();
      const admin = supabaseAdmin();

      const { error: uploadError } = await admin.storage.from(bucket).upload(objectPath, binary, {
        cacheControl: "3600",
        contentType: "image/png",
        upsert: false,
      });
      if (uploadError) {
        logImg("error", { code: "MEDIA_UPLOAD_FAILED", mode: "generate" });
        return jsonErr(ctx.rid, "Could not upload generated image.", 500, "MEDIA_UPLOAD_FAILED");
      }

      const { data: urlData } = admin.storage.from(bucket).getPublicUrl(objectPath);
      const publicUrl = typeof urlData?.publicUrl === "string" ? urlData.publicUrl : "";
      if (!publicUrl) {
        logImg("error", { code: "MEDIA_UPLOAD_URL_FAILED", mode: "generate" });
        return jsonErr(ctx.rid, "Could not resolve media URL.", 500, "MEDIA_UPLOAD_URL_FAILED");
      }

      const { data: inserted, error: insertError } = await admin
        .from("media_items")
        .insert({
          type: "image",
          status: "ready",
          source: "ai",
          url: publicUrl,
          alt: "",
          caption: null,
          tags: ["ai", "generated"],
          width: null,
          height: null,
          mime_type: "image/png",
          bytes: binary.length,
          metadata: { aiModel: "gpt-image-1", prompt, storageBucket: bucket, path: objectPath },
          created_by: ctx.scope?.email ?? null,
        } as Record<string, unknown>)
        .select("id, url")
        .single();

      if (insertError || !inserted || typeof inserted.id !== "string" || typeof inserted.url !== "string") {
        logImg("error", { code: "MEDIA_CREATE_FAILED", mode: "generate" });
        return jsonErr(ctx.rid, "Could not create media item.", 500, "MEDIA_CREATE_FAILED");
      }

      logImg("success", { mode: "generate", assetId: inserted.id });
      return jsonOk(
        ctx.rid,
        {
          assetId: inserted.id,
          url: inserted.url,
        },
        200
      );
    } catch (e) {
      if (e instanceof AiRunnerError) {
        logImg("error", { code: e.code, mode: "generate" });
        const status =
          e.code === "AI_DISABLED"
            ? 503
            : e.code === "PLAN_NOT_ALLOWED" ||
                e.code === "USAGE_LIMIT_EXCEEDED" ||
                e.code === "PROFITABILITY_BLOCK" ||
                e.code === "PROFITABILITY_CONTEXT_FAILED"
              ? 403
              : 500;
        return jsonErr(ctx.rid, e.message, status, e.code);
      }
      logImg("error", { code: "IMAGE_GENERATION_FAILED", mode: "generate", thrown: true });
      return jsonErr(ctx.rid, "Image generation failed.", 500, "IMAGE_GENERATION_FAILED");
    }
  }

  const imgInput = {
    locale,
    purpose,
    topic: topicForTool || "Lunchportalen",
    brand,
    style,
    count: 2 as const,
  };
  const out = imageGenerateBrandSafe({ input: imgInput });

  if (!out.prompts || out.prompts.length === 0) {
    logImg("error", { code: "GENERATION_FAILED", mode: "prompts" });
    return jsonErr(ctx.rid, "No prompt suggestions produced.", 500, "GENERATION_FAILED");
  }

  logImg("success", {
    mode: "prompts",
    promptCount: out.prompts.length,
    purpose,
    locale,
    style,
  });

  const revisedPrompt = out.prompts[0]?.prompt ?? `Brand-safe image for ${purpose}: ${topicForTool}. Style: ${style}.`;
  return jsonOk(ctx.rid, {
    message: out.summary,
    revisedPrompt,
    prompts: out.prompts,
    purpose,
    topic: topicForTool,
  }, 200);
  });
}
