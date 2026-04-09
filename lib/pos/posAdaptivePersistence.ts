import "server-only";

import { loadPatternWeights } from "@/lib/ai/learning";
import type { PosImpactScores, PosTriggerHints } from "@/lib/pos/posAdaptive";
import type { PosAdaptiveKnobsLoaded } from "@/lib/pos/posAdaptiveKnobs";
import type { PosSignalPriority, PosStabilizeStats } from "@/lib/pos/posStabilizer";
import type { ProductSurface } from "@/lib/pos/surfaceRegistry";
import { supabaseAdmin } from "@/lib/supabase/admin";

const KEY_MIN = "pos_adapt:min_conf";
const KEY_MAX = "pos_adapt:max_active";
const KEY_OUTCOME = "pos_adapt:cycle_outcome_ewma";
const SURF_PREFIX = "pos_adapt:mult:";

function hasServiceEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

function adaptiveEnabled(): boolean {
  const raw = String(process.env.POS_ADAPTIVE ?? "1").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Map learning weight [-5,5] → min confidence [0.06, 0.32]. */
export function weightToMinConfidence(w: number): number {
  const x = (clamp(w, -5, 5) + 5) / 10;
  return 0.06 + x * 0.26;
}

export function minConfidenceToWeight(m: number): number {
  const x = (clamp(m, 0.06, 0.32) - 0.06) / 0.26;
  return x * 10 - 5;
}

/** weight ≈ maxActive - 5, maxActive in [2,8]. */
export function weightToMaxActive(w: number): number {
  return Math.round(clamp(w + 5, 2, 8));
}

export function maxActiveToWeight(m: number): number {
  return clamp(m - 5, -3, 3);
}

function weightToSurfaceMult(w: number): number {
  return clamp(1 + 0.04 * clamp(w, -2, 2), 0.88, 1.12);
}

export async function loadPosAdaptiveKnobs(): Promise<PosAdaptiveKnobsLoaded> {
  const defaults = {
    minConfidence:
      Number(process.env.POS_MIN_CONFIDENCE) >= 0 && Number(process.env.POS_MIN_CONFIDENCE) <= 1
        ? Number(process.env.POS_MIN_CONFIDENCE)
        : 0.12,
    maxActiveSurfaces:
      Number.isFinite(Number(process.env.POS_MAX_ACTIVE_SURFACES)) &&
      Number(process.env.POS_MAX_ACTIVE_SURFACES) >= 1
        ? Math.floor(Number(process.env.POS_MAX_ACTIVE_SURFACES))
        : 4,
  };

  if (!hasServiceEnv() || !adaptiveEnabled()) {
    return { ...defaults, surfaceMultiplier: {}, fromDb: false };
  }

  try {
    const w = await loadPatternWeights();
    const minW = w[KEY_MIN];
    const maxW = w[KEY_MAX];
    const mults: Partial<Record<ProductSurface, number>> = {};
    for (const [k, v] of Object.entries(w)) {
      if (!k.startsWith(SURF_PREFIX)) continue;
      const surf = k.slice(SURF_PREFIX.length) as ProductSurface;
      if (surf) mults[surf] = weightToSurfaceMult(v);
    }
    return {
      minConfidence: typeof minW === "number" && Number.isFinite(minW) ? weightToMinConfidence(minW) : defaults.minConfidence,
      maxActiveSurfaces:
        typeof maxW === "number" && Number.isFinite(maxW) ? weightToMaxActive(maxW) : defaults.maxActiveSurfaces,
      surfaceMultiplier: mults,
      fromDb: typeof minW === "number" || typeof maxW === "number" || Object.keys(mults).length > 0,
    };
  } catch {
    return { ...defaults, surfaceMultiplier: {}, fromDb: false };
  }
}

async function upsertPatternRow(
  pattern_key: string,
  weight: number,
  evidence_count: number,
  last_reason: string,
  based_on: string[],
): Promise<void> {
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase.from("ai_learning_patterns").upsert(
    {
      pattern_key,
      weight: clamp(weight, -5, 5),
      evidence_count,
      last_reason: last_reason.slice(0, 2000),
      based_on,
      updated_at: now,
    },
    { onConflict: "pattern_key" },
  );
  if (error) throw new Error(error.message);
}

async function fetchEvidenceCounts(keys: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (keys.length === 0) return out;
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_learning_patterns")
      .select("pattern_key, evidence_count")
      .in("pattern_key", keys);
    if (error || !data) return out;
    for (const row of data as { pattern_key: string; evidence_count: number }[]) {
      out.set(row.pattern_key, Number(row.evidence_count) || 0);
    }
  } catch {
    /* fail closed */
  }
  return out;
}

/**
 * Persists last cycle summary + nudges adaptive knobs into `ai_learning_patterns` (existing table).
 * Best-effort: failures are swallowed (POS must not fail on persistence).
 */
export async function persistPosAdaptiveOutcome(params: {
  stats: PosStabilizeStats;
  decisionCount: number;
  dynamicPriority: PosSignalPriority;
  impacts: PosImpactScores;
  hints: PosTriggerHints;
  trafficPages: number;
  surfacesCapped: ProductSurface[];
  highConfidenceActiveSurfaces: ProductSurface[];
}): Promise<void> {
  if (!hasServiceEnv() || !adaptiveEnabled()) return;

  const n = Math.max(1, params.decisionCount);
  const skipRate = params.stats.skipped_low_confidence / n;
  const capRate = params.stats.capped_inactive_surfaces / n;
  const dupRate = params.stats.suppressed_duplicate_actions / n;
  const activeRate = params.stats.active_non_observe_surfaces / n;

  const proxyOutcome = clamp(activeRate * (1 - dupRate * 0.4) - skipRate * 0.15, -1, 1);

  try {
    const weights = await loadPatternWeights();
    const envMin =
      Number(process.env.POS_MIN_CONFIDENCE) >= 0 && Number(process.env.POS_MIN_CONFIDENCE) <= 1
        ? Number(process.env.POS_MIN_CONFIDENCE)
        : 0.12;
    const envMax =
      Number.isFinite(Number(process.env.POS_MAX_ACTIVE_SURFACES)) &&
      Number(process.env.POS_MAX_ACTIVE_SURFACES) >= 1
        ? Math.floor(Number(process.env.POS_MAX_ACTIVE_SURFACES))
        : 4;

    let minC =
      typeof weights[KEY_MIN] === "number" && Number.isFinite(weights[KEY_MIN])
        ? weightToMinConfidence(weights[KEY_MIN])
        : envMin;
    let maxA =
      typeof weights[KEY_MAX] === "number" && Number.isFinite(weights[KEY_MAX])
        ? weightToMaxActive(weights[KEY_MAX])
        : envMax;

    if (skipRate > 0.42) minC -= 0.014;
    if (skipRate < 0.06 && dupRate < 0.12) minC += 0.007;
    if (capRate > 0.32) maxA += 1;
    if (capRate === 0 && params.stats.active_non_observe_surfaces <= 1 && params.trafficPages > 800) maxA -= 1;
    if (dupRate > 0.35) minC += 0.01;

    minC = clamp(minC, 0.06, 0.34);
    maxA = Math.round(clamp(maxA, 2, 8));

    const prevEwma =
      typeof weights[KEY_OUTCOME] === "number" && Number.isFinite(weights[KEY_OUTCOME]) ? weights[KEY_OUTCOME] : 0;
    const nextEwma = clamp(prevEwma * 0.88 + proxyOutcome * 0.12, -3, 3);

    const evKeys = [KEY_MIN, KEY_MAX, KEY_OUTCOME];
    const surfKeys = [
      ...new Set([
        ...[...new Set(params.surfacesCapped)].map((s) => `${SURF_PREFIX}${s}`),
        ...[...new Set(params.highConfidenceActiveSurfaces)].map((s) => `${SURF_PREFIX}${s}`),
      ]),
    ];
    const evMap = await fetchEvidenceCounts([...evKeys, ...surfKeys]);

    await upsertPatternRow(
      KEY_MIN,
      minConfidenceToWeight(minC),
      (evMap.get(KEY_MIN) ?? 0) + 1,
      `pos_adapt min_conf tuned skip=${skipRate.toFixed(2)}`,
      ["pos_adaptive"],
    );
    await upsertPatternRow(
      KEY_MAX,
      maxActiveToWeight(maxA),
      (evMap.get(KEY_MAX) ?? 0) + 1,
      `pos_adapt max_active tuned cap=${capRate.toFixed(2)}`,
      ["pos_adaptive"],
    );
    await upsertPatternRow(
      KEY_OUTCOME,
      nextEwma,
      (evMap.get(KEY_OUTCOME) ?? 0) + 1,
      JSON.stringify({
        at: new Date().toISOString(),
        dynamicPriority: params.dynamicPriority,
        impacts: params.impacts,
        hints: params.hints,
        active: params.stats.active_non_observe_surfaces,
        skipped: params.stats.skipped_low_confidence,
        capped: params.stats.capped_inactive_surfaces,
        dupes: params.stats.suppressed_duplicate_actions,
        proxyOutcome,
      }).slice(0, 1900),
      ["pos_adaptive"],
    );

    for (const s of [...new Set(params.surfacesCapped)]) {
      const k = `${SURF_PREFIX}${s}`;
      const curW = typeof weights[k] === "number" && Number.isFinite(weights[k]) ? weights[k]! : 0;
      await upsertPatternRow(k, clamp(curW - 0.15, -2, 2), (evMap.get(k) ?? 0) + 1, `pos_adapt cap_penalty ${s}`, [
        "pos_adaptive",
      ]);
    }
    for (const s of [...new Set(params.highConfidenceActiveSurfaces)]) {
      if (params.surfacesCapped.includes(s)) continue;
      const k = `${SURF_PREFIX}${s}`;
      const curW = typeof weights[k] === "number" && Number.isFinite(weights[k]) ? weights[k]! : 0;
      await upsertPatternRow(k, clamp(curW + 0.08, -2, 2), (evMap.get(k) ?? 0) + 1, `pos_adapt boost ${s}`, [
        "pos_adaptive",
      ]);
    }
  } catch {
    /* best-effort */
  }
}
