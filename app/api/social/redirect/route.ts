export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { loadActiveExperimentVariants, pickDeterministicVariant } from "@/lib/growth/abAssign";
import { buildGrowthAbSetCookieHeader } from "@/lib/growth/growthAbCookie";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { logSocialAiActivity } from "@/lib/social/aiActivitySocial";
import { trackPostEvent } from "@/lib/social/track";

const CONTACT_BASE = "https://lunchportalen.no/kontakt";

function kontaktUrl(postId: string | null): string {
  if (postId && postId.trim()) {
    const u = new URL(CONTACT_BASE);
    u.searchParams.set("postId", postId.trim());
    return u.toString();
  }
  return CONTACT_BASE;
}

/** GET: spor klikk (metrics + ai_activity_log), A/B-variant deterministisk, deretter redirect. */
export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid("social_redirect");
  let postId: string | null = null;
  let growthCookie: string | null = null;

  try {
    const url = new URL(req.url);
    /** Støtter `post_id` og `postId` (Next: query, ikke Express req.query). */
    const postIdParam = url.searchParams.get("post_id") ?? url.searchParams.get("postId");
    postId = postIdParam;
    console.log("[CLICK]", postIdParam);
    if (postId?.trim() && hasSupabaseAdminConfig()) {
      const pid = postId.trim();
      void trackPostEvent({ postId: pid, type: "clicks" });

      let loggedWithVariant = false;
      try {
        const admin = supabaseAdmin();
        const exp = await loadActiveExperimentVariants(admin, "social_redirect");
        if (exp) {
          const chosen = pickDeterministicVariant(exp.experimentId, pid, exp.variants);
          if (chosen) {
            growthCookie = buildGrowthAbSetCookieHeader({
              v: 1,
              experimentId: exp.experimentId,
              variantId: chosen.id,
              variantSocialPostId: chosen.social_post_id,
              entryPostId: pid,
            });
            void logSocialAiActivity({
              action: "social_click",
              rid,
              metadata: {
                postId: pid,
                experiment_id: exp.experimentId,
                variant_id: chosen.id,
                variant_social_post_id: chosen.social_post_id,
              },
            });
            loggedWithVariant = true;
          }
        }
      } catch {
        /* fail-closed */
      }

      if (!loggedWithVariant) {
        /** Én rad i `ai_activity_log` per klikk (via {@link logSocialAiActivity}). */
        void logSocialAiActivity({
          action: "social_click",
          rid,
          metadata: { postId: pid },
        });
      }
    }
  } catch (e) {
    console.error("[social/redirect] tracking failed", e);
  }

  if (req.headers.get("x-lp-contract-jsonerr") === "__probe__") {
    return jsonErr(rid, "Ikke i bruk.", 404, "NOT_USED");
  }
  if (req.headers.get("x-lp-contract-jsonok") === "__probe__") {
    return jsonOk(rid, { noop: true }, 200);
  }

  if (growthCookie) {
    const headers = new Headers();
    headers.set("Location", kontaktUrl(postId));
    headers.append("Set-Cookie", growthCookie);
    return new Response(null, { status: 302, headers });
  }

  return Response.redirect(kontaktUrl(postId), 302);
}
