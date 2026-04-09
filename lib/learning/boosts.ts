import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { opsLog } from "@/lib/ops/log";

export const GROWTH_LEARNING_KIND = "growth_learning" as const;

/** Multiplicative weights for strategy action keys (deterministic, from last persisted row). */
export type StrategyBoostMap = Partial<Record<string, number>>;

export async function loadStrategyBoosts(admin: SupabaseClient): Promise<StrategyBoostMap> {
  const { data, error } = await admin
    .from("ai_activity_log")
    .select("metadata")
    .eq("action", "audit")
    .order("created_at", { ascending: false })
    .limit(120);

  if (error || !Array.isArray(data)) {
    return {};
  }

  for (const row of data) {
    const m = row?.metadata as Record<string, unknown> | undefined;
    if (!m || m.kind !== GROWTH_LEARNING_KIND) continue;
    const boosts = m.boosts;
    if (boosts && typeof boosts === "object" && !Array.isArray(boosts)) {
      const out: StrategyBoostMap = {};
      for (const [k, v] of Object.entries(boosts as Record<string, unknown>)) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0 && n < 10) out[k] = n;
      }
      return out;
    }
  }

  return {};
}

async function persistMergedBoosts(admin: SupabaseClient, rid: string, merged: StrategyBoostMap): Promise<void> {
  const row = buildAiActivityLogRow({
    action: "audit",
    metadata: {
      kind: GROWTH_LEARNING_KIND,
      rid,
      boosts: merged,
      updatedAt: new Date().toISOString(),
    },
  });

  const { error } = await admin.from("ai_activity_log").insert(row as Record<string, unknown>);
  if (error) {
    opsLog("growth_learning_persist_failed", { rid, message: error.message });
  }
}

export async function persistStrategyBoosts(
  admin: SupabaseClient,
  params: { rid: string; boosts: StrategyBoostMap }
): Promise<void> {
  const prev = await loadStrategyBoosts(admin);
  const merged: StrategyBoostMap = { ...prev };
  for (const [k, v] of Object.entries(params.boosts)) {
    const mult = Number(v);
    if (!Number.isFinite(mult) || mult <= 0 || mult >= 10) continue;
    const p = merged[k] ?? 1;
    merged[k] = Math.min(9.99, p * mult);
  }

  await persistMergedBoosts(admin, params.rid, merged);
}

/**
 * Nedjuster vekter deterministisk (f.eks. 0.97) når eksperiment ikke slår baseline.
 */
export async function persistStrategyPenalties(
  admin: SupabaseClient,
  params: { rid: string; penalties: StrategyBoostMap }
): Promise<void> {
  const prev = await loadStrategyBoosts(admin);
  const merged: StrategyBoostMap = { ...prev };
  for (const [k, v] of Object.entries(params.penalties)) {
    const mult = Number(v);
    if (!Number.isFinite(mult) || mult >= 1 || mult <= 0) continue;
    const p = merged[k] ?? 1;
    merged[k] = Math.max(0.1, p * mult);
  }

  await persistMergedBoosts(admin, params.rid, merged);
}
