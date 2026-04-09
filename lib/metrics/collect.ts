import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

export type CollectedMetrics = {
  orders: number;
  users: number;
  conversionRate: number;
  timestamp: number;
};

/**
 * Read-only counts (RLS via service role in cron/server contexts). Fail-closed: errors → zero counts.
 */
export async function collectMetrics(sb: SupabaseClient<Database>): Promise<CollectedMetrics> {
  let orders = 0;
  let users = 0;

  const o = await sb.from("orders").select("id", { count: "exact", head: true });
  if (o.error) {
    // eslint-disable-next-line no-console
    console.error("[collectMetrics] orders", o.error.message);
  } else if (typeof o.count === "number") {
    orders = o.count;
  }

  const u = await sb.from("profiles").select("id", { count: "exact", head: true });
  if (u.error) {
    // eslint-disable-next-line no-console
    console.error("[collectMetrics] profiles", u.error.message);
  } else if (typeof u.count === "number") {
    users = u.count;
  }

  return {
    orders,
    users,
    conversionRate: users > 0 ? orders / users : 0,
    timestamp: Date.now(),
  };
}
