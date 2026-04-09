import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AutonomyMetrics } from "@/lib/autonomy/recommendationsTypes";
import { collectMetrics as collectSystemMetrics } from "@/lib/metrics/collect";
import type { Database } from "@/lib/types/database";

/**
 * Maps system metrics into the slimmer shape used by {@link generateRecommendations}.
 */
export async function collectMetrics(sb: SupabaseClient<Database>): Promise<AutonomyMetrics> {
  const m = await collectSystemMetrics(sb);
  return {
    orders: m.orders,
    conversionRate: m.conversionRate,
    users: m.users,
    timestamp: m.timestamp,
  };
}
