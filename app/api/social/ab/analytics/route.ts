export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { groupAbAnalytics } from "@/lib/social/abAnalytics";
import { mapSocialEventsFromDb, mapSocialPostsFromDb } from "@/lib/social/analyticsAggregate";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { fetchSocialPostsAndEvents } from "@/lib/db/growthAdminRead";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "/api/social/ab/analytics";

/** GET: A/B-gruppert ytelse (klikk/leds per post, gruppert på variant_group_id). */
export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid("social_ab_analytics");
  try {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    if (!hasSupabaseAdminConfig()) {
      return jsonErr(rid, "Supabase admin er ikke konfigurert.", 503, "CONFIG_ERROR");
    }

    const bundle = await fetchSocialPostsAndEvents(supabaseAdmin(), ROUTE);
    if (bundle.ok === false) {
      return jsonErr(rid, bundle.error, 200, bundle.code, { detail: bundle.error });
    }

    const grouped = groupAbAnalytics(
      mapSocialPostsFromDb(bundle.posts),
      mapSocialEventsFromDb(bundle.events),
    );
    return jsonOk(rid, grouped, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, message, 500, "SOCIAL_AB_ANALYTICS_UNHANDLED");
  }
}
