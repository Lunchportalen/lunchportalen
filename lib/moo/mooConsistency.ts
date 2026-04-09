import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getMooConsistencyRevenueRows } from "@/lib/moo/mooConfig";

/**
 * Last N revenue rows must not contradict the chosen winner: winner's attributed revenue sum
 * in that window must be >= baseline A's sum (deterministic tie-break: strict inequality not required if winner is A).
 */
export async function revenueConsistencyOk(opts: {
  supabase: SupabaseClient;
  experimentId: string;
  winnerVariantId: string;
  baselineVariantId: string;
}): Promise<boolean> {
  const n = getMooConsistencyRevenueRows();
  const { data, error } = await opts.supabase
    .from("experiment_revenue")
    .select("variant_id,revenue")
    .eq("experiment_id", opts.experimentId)
    .order("created_at", { ascending: false })
    .limit(n);

  if (error || !data?.length) return true;

  let sumA = 0;
  let sumW = 0;
  for (const row of data) {
    const vid = String((row as { variant_id?: string }).variant_id ?? "");
    const rev = Number((row as { revenue?: unknown }).revenue ?? 0);
    if (!Number.isFinite(rev) || rev < 0) continue;
    if (vid === opts.baselineVariantId) sumA += rev;
    if (vid === opts.winnerVariantId) sumW += rev;
  }

  if (opts.winnerVariantId === opts.baselineVariantId) return true;
  return sumW >= sumA;
}
