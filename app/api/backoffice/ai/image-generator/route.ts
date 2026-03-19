/**
 * POST /api/backoffice/ai/image-generator
 * Prompt-suggestion only: returns prompts and alt text for brand-safe images. No image generation, no placeholder URLs.
 * Request: { prompt?, topic?, purpose?, locale?, style?, brand? }
 * Response: { message, revisedPrompt, prompts: [{ prompt, alt }], purpose, topic }.
 */
import type { NextRequest } from "next/server";
import { isAIEnabled } from "@/lib/ai/provider";
import { imageGenerateBrandSafe } from "@/lib/ai/tools/imageGenerateBrandSafe";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;
  const ctx = gate.ctx;
  if (!isAIEnabled()) return jsonErr(ctx.rid, "AI is disabled.", 503, "FEATURE_DISABLED");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(ctx.rid, "Invalid JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body must be an object.", 400, "BAD_REQUEST");

  const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
  const topic = typeof o.topic === "string" ? o.topic.trim() : "";
  const purpose = (o.purpose === "section" || o.purpose === "social" ? o.purpose : "hero") as "hero" | "section" | "social";
  const hasPrompt = prompt.length > 0;
  const hasTopicAndPurpose = topic.length > 0;
  if (!hasPrompt && !hasTopicAndPurpose) {
    return jsonErr(ctx.rid, "Missing prompt and (topic + purpose); provide prompt or both topic and purpose.", 400, "MISSING_INPUT");
  }

  const locale = o.locale === "en" ? "en" : "nb";
  const style = o.style === "warm_enterprise" ? ("warm_enterprise" as const) : ("scandi_minimal" as const);
  const topicForTool = hasPrompt ? prompt : topic;
  const brand = typeof o.brand === "string" ? o.brand.trim() : "Lunchportalen";

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
    return jsonErr(ctx.rid, "No prompt suggestions produced.", 500, "GENERATION_FAILED");
  }

  try {
    const { error } = await supabaseAdmin().from("ai_activity_log").insert(
      buildAiActivityLogRow({
        action: "image_prompts",
        page_id: null,
        variant_id: null,
        actor_user_id: ctx.scope?.email ?? null,
        tool: "image_generate",
        environment: "preview",
        locale,
        metadata: { promptCount: out.prompts.length, purpose },
      })
    );
    if (error) {
      const { opsLog } = await import("@/lib/ops/log");
      opsLog("ai_activity_log.insert_failed", { route: "image-generator", action: "image_prompts", error: error.message });
    }
  } catch {
    // Best-effort: do not mask response
  }

  const revisedPrompt = out.prompts[0]?.prompt ?? `Brand-safe image for ${purpose}: ${topicForTool}. Style: ${style}.`;
  return jsonOk(ctx.rid, {
    message: out.summary,
    revisedPrompt,
    prompts: out.prompts,
    purpose,
    topic: topicForTool,
  }, 200);
}
