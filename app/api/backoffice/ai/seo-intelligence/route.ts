import type { NextRequest } from "next/server";
import { computeSeoIntelligence } from "@/lib/seo/intelligence";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { checkAiRateLimit, AI_RATE_LIMIT_SCOPE, DEFAULT_AI_EDITOR_RATE_LIMIT } from "@/lib/ai/rateLimit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseBlocks(raw: unknown): Array<{ id: string; type: string; data?: Record<string, unknown> }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is Record<string, unknown> => b != null && typeof b === "object" && !Array.isArray(b))
    .filter((b) => typeof b.id === "string" && typeof b.type === "string")
    .map((b) => ({
      id: String(b.id),
      type: String(b.type),
      data: b.data != null && typeof b.data === "object" && !Array.isArray(b.data) ? (b.data as Record<string, unknown>) : undefined,
    }));
}

function parseMeta(raw: unknown): Record<string, unknown> | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  return raw as Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;
  const ctx = gate.ctx;

  const identity = ctx.scope?.email ?? ctx.scope?.sub ?? "anon";
  const rl = checkAiRateLimit(identity, `${AI_RATE_LIMIT_SCOPE}:seo-intelligence`, DEFAULT_AI_EDITOR_RATE_LIMIT);
  if (!rl.allowed) {
    const extraHeaders: HeadersInit | undefined =
      rl.retryAfterSeconds != null ? { "Retry-After": String(rl.retryAfterSeconds) } : undefined;
    return jsonErr(ctx.rid, "Rate limit exceeded. Prøv igjen senere.", 429, "RATE_LIMIT", undefined, extraHeaders);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const { opsLog } = await import("@/lib/ops/log");
    opsLog("seo_intelligence.bad_request", { rid: ctx.rid, reason: "invalid_json" });
    return jsonErr(ctx.rid, "Invalid JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) {
    const { opsLog } = await import("@/lib/ops/log");
    opsLog("seo_intelligence.bad_request", { rid: ctx.rid, reason: "body_not_object" });
    return jsonErr(ctx.rid, "Body must be an object.", 400, "BAD_REQUEST");
  }

  const blocks = parseBlocks(o.blocks);
  const meta = parseMeta(o.meta);
  const pageTitle = typeof o.pageTitle === "string" ? o.pageTitle.trim() : undefined;
  const locale = o.locale === "en" ? "en" : "nb";
  const goal = o.goal === "info" || o.goal === "signup" ? o.goal : "lead";
  const brand = typeof o.brand === "string" ? o.brand.trim() : undefined;

  let result: import("@/lib/seo/intelligence").SeoIntelligenceResult;
  try {
    result = computeSeoIntelligence({
      blocks,
      meta,
      pageTitle,
      locale,
      goal,
      brand,
    });
  } catch (e) {
    const { opsLog } = await import("@/lib/ops/log");
    opsLog("seo_intelligence.compute_failed", { rid: ctx.rid, error: e instanceof Error ? e.message : String(e) });
    return jsonErr(ctx.rid, "SEO-analyse feilet.", 500, "SEO_INTELLIGENCE_COMPUTE_FAILED");
  }

  try {
    const { error } = await supabaseAdmin().from("ai_activity_log").insert(
      buildAiActivityLogRow({
        action: "seo_intelligence_scored",
        page_id: typeof o.pageId === "string" ? o.pageId : null,
        variant_id: null,
        actor_user_id: ctx.scope?.email ?? null,
        tool: "seo_intelligence",
        environment: "preview",
        locale,
        metadata: { score: result.score, suggestionCount: result.suggestions.length },
      })
    );
    if (error) {
      const { opsLog } = await import("@/lib/ops/log");
      opsLog("ai_activity_log.insert_failed", { route: "seo-intelligence", action: "seo_intelligence_scored", error: error.message });
      return jsonErr(ctx.rid, "Kunne ikke logge SEO-analyse.", 500, "SEO_INTELLIGENCE_LOG_FAILED");
    }
    const { recordSeoLearning } = await import("@/lib/ai/memory/recordOutcome");
    await recordSeoLearning(supabaseAdmin(), {
      pageId: typeof o.pageId === "string" ? o.pageId : null,
      score: result.score,
      suggestionCount: result.suggestions.length,
      sourceRid: ctx.rid,
    });
  } catch (e) {
    const { opsLog } = await import("@/lib/ops/log");
    opsLog("ai_activity_log.insert_failed", { route: "seo-intelligence", action: "seo_intelligence_scored", error: e instanceof Error ? e.message : String(e) });
    return jsonErr(ctx.rid, "Kunne ikke logge SEO-analyse.", 500, "SEO_INTELLIGENCE_LOG_FAILED");
  }

  return jsonOk(ctx.rid, result, 200);
}
