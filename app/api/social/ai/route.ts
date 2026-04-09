export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// CONTROL_TOWER_SOURCE

import type { NextRequest } from "next/server";

import { getNextActions } from "@/lib/social/actionEngine";
import {
  attachSourceTextToAnalytics,
  generateFromTopPosts,
} from "@/lib/social/aiGenerator";
import {
  aggregateSocialAnalytics,
  mapSocialEventsFromDb,
  mapSocialPostsFromDb,
} from "@/lib/social/analyticsAggregate";
import { extractPatterns } from "@/lib/social/patterns";
import { getRecommendations } from "@/lib/social/recommendations";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import {
  AI_RATE_LIMIT_SCOPE,
  checkAiRateLimit,
  rateLimitOverload,
  SOCIAL_AI_RL,
} from "@/lib/security/rateLimit";
import { fetchSocialPostsAndEvents } from "@/lib/db/growthAdminRead";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "/api/social/ai";

/**
 * GET: deterministisk «AI growth»-pakke — samme datagrunnlag som
 * `/api/social/analytics` og `/api/social/recommendations` (aggregat + anbefalinger),
 * uten intern HTTP og uten eksterne modeller.
 */
export async function GET(req: NextRequest): Promise<Response> {
  let rid = makeRid("social_ai");
  try {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    rid = gate.ctx.rid || rid;
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    const identity = gate.ctx.scope?.email ?? gate.ctx.scope?.sub ?? gate.ctx.scope?.userId ?? "unknown";
    const rl = checkAiRateLimit(String(identity), `${AI_RATE_LIMIT_SCOPE}:social_ai`, SOCIAL_AI_RL);
    if (!rl.allowed) {
      return jsonErr(
        rid,
        "For mange forsøk. Prøv igjen senere.",
        429,
        "RATE_LIMIT",
        undefined,
        rl.retryAfterSeconds != null ? { "Retry-After": String(rl.retryAfterSeconds) } : undefined,
      );
    }
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (!rateLimitOverload(`social_ai:${ip}`, 50)) {
      return jsonErr(rid, "Tjenesten er midlertidig overbelastet. Prøv igjen senere.", 503, "OVERLOAD");
    }

    if (!hasSupabaseAdminConfig()) {
      return jsonErr(rid, "Supabase admin er ikke konfigurert.", 503, "CONFIG_ERROR");
    }

    const bundle = await fetchSocialPostsAndEvents(supabaseAdmin(), ROUTE);
    if (bundle.ok === false) {
      return jsonErr(rid, bundle.error, 200, bundle.code, { detail: bundle.error });
    }

    const postRows = mapSocialPostsFromDb(bundle.posts);
    const eventRows = mapSocialEventsFromDb(bundle.events);
    const analytics = aggregateSocialAnalytics(postRows, eventRows);
    const recommendations = getRecommendations(analytics);
    const withText = attachSourceTextToAnalytics(analytics, postRows);
    const patterns = extractPatterns(analytics);
    const generated = generateFromTopPosts(withText);
    const actions = getNextActions(analytics);

    return jsonOk(rid, { patterns, generated, actions, recommendations }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, message, 500, "SOCIAL_AI_UNHANDLED");
  }
}
