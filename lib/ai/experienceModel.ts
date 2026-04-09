import "server-only";

import { decay } from "@/lib/ai/memoryDecay";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Require this many outcome rows per action_type before its signal influences scoring. */
export const EXPERIENCE_MIN_SAMPLES = 5;

/** Absolute cap on aggregated learning signal per action_type (symmetric). */
export const EXPERIENCE_BONUS_CAP = 50;

export type ExperienceRow = {
  action_type: string | null;
  outcome_score: number | string | null;
  success: boolean | null;
};

/**
 * Aggregates damped, capped bonuses per action_type. Deterministic given row order.
 */
export function computeExperienceBonuses(rows: ExperienceRow[]): Record<string, number> {
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = String(row.action_type ?? "unknown").trim() || "unknown";
    const v = Number(row.outcome_score ?? 0);
    if (!Number.isFinite(v)) continue;
    sums[key] = (sums[key] ?? 0) + v;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const out: Record<string, number> = {};
  for (const key of Object.keys(sums)) {
    if ((counts[key] ?? 0) < EXPERIENCE_MIN_SAMPLES) continue;
    const damped = decay(sums[key] ?? 0);
    out[key] = Math.min(EXPERIENCE_BONUS_CAP, Math.max(-EXPERIENCE_BONUS_CAP, damped));
  }
  return out;
}

/**
 * Loads recent labeled outcomes from ai_memory. Fails closed to {} on error (deterministic fallback).
 */
export async function getExperienceScores(): Promise<Record<string, number>> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_memory")
      .select("action_type, outcome_score, success")
      .not("action_type", "is", null)
      .not("outcome_score", "is", null)
      .order("created_at", { ascending: true })
      .limit(2000);
    if (error) {
      opsLog("experience_model_query_failed", { message: error.message });
      return {};
    }
    return computeExperienceBonuses((data ?? []) as ExperienceRow[]);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("experience_model_failed", { message });
    return {};
  }
}
