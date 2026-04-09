import "server-only";

import type { AbVariantStats } from "@/lib/social/abAnalytics";
import { groupAbAnalytics } from "@/lib/social/abAnalytics";
import { mapSocialEventsFromDb, mapSocialPostsFromDb } from "@/lib/social/analyticsAggregate";
import { fetchSocialPostsAndEvents } from "@/lib/db/growthAdminRead";
import { pickWinner } from "@/lib/social/abWinner";
import { getScalingActions, type AbScaleAction } from "@/lib/social/scaleEngine";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "computeSocialAbDecisions";

export type SocialAbDecisionsResult = {
  winners: AbVariantStats[];
  actions: AbScaleAction[];
};

/**
 * Samme beslutningslogikk som `/api/social/ab/decisions` (uten HTTP).
 */
export async function computeSocialAbDecisions(): Promise<
  { ok: true; data: SocialAbDecisionsResult } | { ok: false; error: string }
> {
  if (!hasSupabaseAdminConfig()) {
    return { ok: false, error: "CONFIG_ERROR" };
  }

  const bundle = await fetchSocialPostsAndEvents(supabaseAdmin(), ROUTE);
  if (bundle.ok === false) {
    return { ok: false, error: bundle.error };
  }

  const groups = groupAbAnalytics(
    mapSocialPostsFromDb(bundle.posts),
    mapSocialEventsFromDb(bundle.events),
  );
  const groupKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
  const winners = groupKeys
    .map((k) => pickWinner(groups[k] ?? []))
    .filter((w): w is AbVariantStats => w != null);
  const actions = getScalingActions(groups);

  return { ok: true, data: { winners, actions } };
}
