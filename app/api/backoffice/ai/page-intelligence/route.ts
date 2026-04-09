/**
 * POST /api/backoffice/ai/page-intelligence
 *
 * Unified page optimization: one call returns SEO + CRO + interplay.
 * Same auth and body shape as seo-intelligence; uses lib/optimization/pageOptimization.
 * Existing seo-intelligence and client-side CRO flows are unchanged.
 */
import type { NextRequest } from "next/server";
import { computePageOptimization } from "@/lib/optimization/pageOptimization";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { checkAiRateLimit, AI_RATE_LIMIT_SCOPE, DEFAULT_AI_EDITOR_RATE_LIMIT } from "@/lib/ai/rateLimit";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

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
  return withApiAiEntrypoint(req, "POST", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;
  const ctx = gate.ctx;

  const identity = ctx.scope?.email ?? ctx.scope?.sub ?? "anon";
  const rl = checkAiRateLimit(identity, `${AI_RATE_LIMIT_SCOPE}:page-intelligence`, DEFAULT_AI_EDITOR_RATE_LIMIT);
  if (!rl.allowed) {
    const extraHeaders: HeadersInit | undefined =
      rl.retryAfterSeconds != null ? { "Retry-After": String(rl.retryAfterSeconds) } : undefined;
    return jsonErr(ctx.rid, "Rate limit exceeded. Prøv igjen senere.", 429, "RATE_LIMIT", undefined, extraHeaders);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(ctx.rid, "Invalid JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body must be an object.", 400, "BAD_REQUEST");

  const blocks = parseBlocks(o.blocks);
  const meta = parseMeta(o.meta);
  const pageTitle = typeof o.pageTitle === "string" ? o.pageTitle.trim() : undefined;
  const locale = o.locale === "en" ? "en" : "nb";
  const goal = o.goal === "info" || o.goal === "signup" ? o.goal : "lead";
  const brand = typeof o.brand === "string" ? o.brand.trim() : undefined;

  let result: import("@/lib/optimization/pageOptimization").PageOptimizationResult;
  try {
    result = computePageOptimization({
      blocks,
      meta,
      pageTitle,
      locale,
      goal,
      brand,
    });
  } catch (e) {
    const { opsLog } = await import("@/lib/ops/log");
    opsLog("page_intelligence.compute_failed", { rid: ctx.rid, error: e instanceof Error ? e.message : String(e) });
    return jsonErr(ctx.rid, "Sideoptimalisering feilet.", 500, "PAGE_INTELLIGENCE_COMPUTE_FAILED");
  }

  try {
    const { error } = await supabaseAdmin().from("ai_activity_log").insert(
      buildAiActivityLogRow({
        action: "seo_intelligence_scored",
        page_id: typeof o.pageId === "string" ? o.pageId : null,
        variant_id: null,
        actor_user_id: ctx.scope?.email ?? null,
        tool: "page_intelligence",
        environment: "preview",
        locale,
        metadata: {
          combined: true,
          seoScore: result.seo.score,
          croScore: result.cro.score,
          seoSuggestions: result.seo.suggestions.length,
          croSuggestions: result.cro.suggestions.length,
        },
      })
    );
    if (error) {
      const { opsLog } = await import("@/lib/ops/log");
      opsLog("ai_activity_log.insert_failed", { route: "page-intelligence", tool: "page_intelligence", error: error.message });
    }
  } catch {
    // Best-effort: do not fail response
  }

  return jsonOk(ctx.rid, result, 200);
  });
}
