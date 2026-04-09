/**
 * Single source of truth for revenue loop: posts, orders, leads + bounded click logs.
 */
import "server-only";

import { verifyTable } from "@/lib/db/verifyTable";
import { collectRevenueData, type CollectedRevenueData } from "@/lib/revenue/collect";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const ROUTE = "revenue_loop_data";
const MAX_CLICK_LOGS = 5000;

export type CollectedLoopData = CollectedRevenueData & {
  logs: Record<string, unknown>[];
};

export async function collectData(client?: SupabaseClient): Promise<CollectedLoopData> {
  const base = await collectRevenueData();
  const logs: Record<string, unknown>[] = [];

  if (!hasSupabaseAdminConfig()) {
    return { ...base, logs };
  }

  const admin = client ?? supabaseAdmin();
  const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
  if (!ok) {
    return { ...base, logs };
  }

  const { data, error } = await admin
    .from("ai_activity_log")
    .select("action, metadata, created_at")
    .eq("action", "social_click")
    .order("created_at", { ascending: false })
    .limit(MAX_CLICK_LOGS);

  if (!error && Array.isArray(data)) {
    logs.push(...(data as Record<string, unknown>[]));
  }

  return { ...base, logs };
}
