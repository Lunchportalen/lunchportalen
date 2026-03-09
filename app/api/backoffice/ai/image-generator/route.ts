import type { NextRequest } from "next/server";
import { isAIEnabled } from "@/lib/ai/provider";
import { imageGenerateBrandSafe } from "@/lib/ai/tools/imageGenerateBrandSafe";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const rid = makeRid();
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin", "company_admin"]);
  if (deny) return deny;
  if (!isAIEnabled()) return jsonErr(rid, "AI is disabled.", 503, "FEATURE_DISABLED");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(rid, "Invalid JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(rid, "Body must be an object.", 400, "BAD_REQUEST");

  const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
  const topic = typeof o.topic === "string" ? o.topic.trim() : "";
  const purpose = (o.purpose === "section" || o.purpose === "social" ? o.purpose : "hero") as "hero" | "section" | "social";
  const hasPrompt = prompt.length > 0;
  const hasTopicAndPurpose = topic.length > 0;
  if (!hasPrompt && !hasTopicAndPurpose) {
    return jsonErr(rid, "Missing prompt and (topic + purpose); provide prompt or both topic and purpose.", 400, "MISSING_INPUT");
  }

  const locale = o.locale === "en" ? "en" : "nb";
  const style = o.style === "warm_enterprise" ? "warm_enterprise" as const : "scandi_minimal" as const;
  const topicForTool = hasPrompt ? prompt : topic;
  const brand = typeof o.brand === "string" ? o.brand.trim() : "Lunchportalen";

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = supabaseAdmin();
  const createdBy = gate.ctx.scope?.email ?? null;

  const imgInput = {
    locale,
    purpose,
    topic: topicForTool || "Lunchportalen",
    brand,
    style,
    count: 2 as const,
  };
  const out = await imageGenerateBrandSafe({ input: imgInput, supabase, createdBy });

  if (!out.candidates || out.candidates.length === 0) {
    return jsonErr(rid, "Image generation produced no candidates.", 500, "GENERATION_FAILED");
  }

  const first = out.candidates[0];
  const imageUrl = typeof first.url === "string" && first.url.trim() ? first.url.trim() : null;
  if (imageUrl === null) {
    return jsonErr(rid, "Image generation produced no usable URL.", 500, "GENERATION_FAILED");
  }

  const revisedPrompt = `Brand-safe image for ${purpose}: ${topicForTool}. Style: ${style}.`;
  return jsonOk(rid, {
    imageUrl,
    revisedPrompt,
    purpose,
    topic: topicForTool,
    message: out.summary,
  }, 200);
}
