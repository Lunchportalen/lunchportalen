import "server-only";

import { extractLearningSignals, type LearningSignalsResult } from "@/lib/ai/feedback";
import type { CmsSurface } from "@/lib/cms/surfaces";
import { calculateResults } from "@/lib/experiments/evaluator";
import { supabaseAdmin } from "@/lib/supabase/admin";

const WEIGHT_MIN = -5;
const WEIGHT_MAX = 5;
const WIN_STEP = 0.4;
const LOSS_STEP = 0.25;

export type StoredPatternRow = {
  pattern_key: string;
  weight: number;
  evidence_count: number;
  last_reason: string | null;
  based_on: string[];
  updated_at: string;
};

/**
 * Load aggregated pattern weights for adaptive scoring. Fails closed to {} on error.
 */
export async function loadPatternWeights(): Promise<Record<string, number>> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from("ai_learning_patterns").select("pattern_key, weight");
    if (error || !data) return {};
    const out: Record<string, number> = {};
    for (const row of data as { pattern_key: string; weight: number }[]) {
      const k = String(row.pattern_key ?? "").trim();
      if (k) out[k] = Number(row.weight) || 0;
    }
    return out;
  } catch {
    return {};
  }
}

export async function loadPatternRows(limit = 50): Promise<StoredPatternRow[]> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_learning_patterns")
      .select("pattern_key, weight, evidence_count, last_reason, based_on, updated_at")
      .order("weight", { ascending: false })
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    return data as StoredPatternRow[];
  } catch {
    return [];
  }
}

function clampWeight(w: number): number {
  return Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, w));
}

/**
 * Merge experiment-derived signals into durable pattern rows (idempotent upsert semantics per key).
 */
export async function storeLearning(signals: LearningSignalsResult): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const keys = new Set<string>();
    const deltas = new Map<string, { delta: number; reason: string; based: string[]; inc: number }>();

    const bump = (key: string, delta: number, reason: string, based: string[], inc: number) => {
      keys.add(key);
      const cur = deltas.get(key);
      if (cur) {
        deltas.set(key, {
          delta: cur.delta + delta,
          reason: cur.reason ? `${cur.reason} | ${reason}` : reason,
          based: [...new Set([...cur.based, ...based])],
          inc: cur.inc + inc,
        });
      } else {
        deltas.set(key, { delta, reason, based: [...based], inc });
      }
    };

    for (const p of signals.winningPatterns) {
      bump(p.patternKey, WIN_STEP * p.confidence, p.reason, p.basedOn, 1);
    }
    for (const p of signals.losingPatterns) {
      bump(p.patternKey, -LOSS_STEP * p.confidence, p.reason, p.basedOn, 1);
    }

    if (keys.size === 0) {
      return { ok: true };
    }

    const supabase = supabaseAdmin();
    const { data: existing, error: readErr } = await supabase
      .from("ai_learning_patterns")
      .select("pattern_key, weight, evidence_count")
      .in("pattern_key", [...keys]);

    if (readErr) return { ok: false, error: readErr.message };

    const prev = new Map<string, { weight: number; evidence_count: number }>();
    for (const row of existing ?? []) {
      const r = row as { pattern_key: string; weight: number; evidence_count: number };
      prev.set(r.pattern_key, { weight: Number(r.weight) || 0, evidence_count: Number(r.evidence_count) || 0 });
    }

    const now = new Date().toISOString();
    for (const [key, { delta, reason, based, inc }] of deltas) {
      const p = prev.get(key) ?? { weight: 0, evidence_count: 0 };
      const weight = clampWeight(p.weight + delta);
      const evidence_count = p.evidence_count + inc;
      const { error } = await supabase.from("ai_learning_patterns").upsert(
        {
          pattern_key: key,
          weight,
          evidence_count,
          last_reason: reason.slice(0, 2000),
          based_on: based,
          updated_at: now,
        },
        { onConflict: "pattern_key" },
      );
      if (error) return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "storeLearning failed";
    return { ok: false, error: msg };
  }
}

/**
 * Pull traffic results + variant blocks, extract signals, persist pattern weights.
 */
export async function learnFromExperiment(
  experimentId: string,
  opts?: { cmsSurface?: CmsSurface },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = String(experimentId ?? "").trim();
  if (!id) return { ok: false, error: "Missing experimentId" };

  const calc = await calculateResults(id);
  if (calc.ok === false) return { ok: false, error: calc.error };

  const supabase = supabaseAdmin();
  const { data: rows, error: vErr } = await supabase
    .from("experiment_variants")
    .select("variant_id, blocks")
    .eq("experiment_id", id);
  if (vErr) return { ok: false, error: vErr.message };

  const variantBlocks: Record<string, unknown[]> = {};
  for (const raw of rows ?? []) {
    const row = raw as { variant_id?: string; blocks?: unknown };
    const vid = String(row.variant_id ?? "").trim();
    if (!vid) continue;
    variantBlocks[vid] = Array.isArray(row.blocks) ? row.blocks : [];
  }

  const signals = extractLearningSignals({
    results: calc.results,
    variantBlocks: Object.keys(variantBlocks).length ? variantBlocks : undefined,
    cmsSurface: opts?.cmsSurface,
  });

  return storeLearning(signals);
}

/** Deterministic autonomy weight nudge from `ai_autonomy_log` outcomes (not persisted). */
export { updateWeights } from "./autonomy/autonomyLearning";
export type { AutonomyLearningWeights } from "./autonomy/autonomyLearning";

/**
 * Ranks `prompt_key` by summed `metadata.revenue` on tracked `ai_conversion` rows (`action` = `agent_run`).
 * Deterministic; fail-closed to [] on error.
 */
export async function getTopPerformingPrompts(): Promise<string[]> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_activity_log")
      .select("metadata")
      .eq("action", "agent_run")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error || !Array.isArray(data)) return [];

    const map: Record<string, number> = {};

    for (const row of data as { metadata?: unknown }[]) {
      const m = row.metadata;
      if (!m || typeof m !== "object" || Array.isArray(m)) continue;
      const meta = m as Record<string, unknown>;
      if (meta.track_event_type !== "ai_conversion") continue;
      const key = typeof meta.prompt_key === "string" ? meta.prompt_key.trim() : "";
      if (!key) continue;
      const revenue = typeof meta.revenue === "number" && Number.isFinite(meta.revenue) ? meta.revenue : 0;
      map[key] = (map[key] || 0) + revenue;
    }

    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  } catch {
    return [];
  }
}
