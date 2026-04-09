import {
  emptyFeatureLearningState,
  type DemoCtaStrategyMode,
  type FeatureLearningState,
  type FeatureStat,
} from "@/lib/public/demoCtaAb/types";

/** Minimum weighted observations before a feature bucket is considered reliable. */
export const DEMO_CTA_FEATURE_MIN_SAMPLE = 5;

export function featureScore(stat: FeatureStat | undefined): number {
  if (!stat) return 0.5;
  const total = stat.success + stat.fail;
  if (total < DEMO_CTA_FEATURE_MIN_SAMPLE) return 0.5;
  return stat.success / total;
}

export function featureTotal(stat: FeatureStat | undefined): number {
  if (!stat) return 0;
  return stat.success + stat.fail;
}

const LEARNING_DIMS: (keyof FeatureLearningState)[] = [
  "tone",
  "verb",
  "framing",
  "length",
  "tone_verb",
  "framing_tone",
  "tone_verb_framing",
];

function pickBlendedStat(c?: FeatureStat, g?: FeatureStat): FeatureStat {
  const tc = featureTotal(c);
  const tg = featureTotal(g);
  if (tc >= DEMO_CTA_FEATURE_MIN_SAMPLE) return c ? { success: c.success, fail: c.fail } : { success: 0, fail: 0 };
  if (tg >= 1e-9) return g ? { success: g.success, fail: g.fail } : { success: 0, fail: 0 };
  if (c && tc > 1e-9) return { success: c.success, fail: c.fail };
  return g ? { success: g.success, fail: g.fail } : { success: 0, fail: 0 };
}

/**
 * Bruker kontekst-spesifikk læring når bucket har nok volum; ellers faller tilbake til global (per nøkkel).
 */
export function blendFeatureLearningForPatternContext(
  global: FeatureLearningState,
  contextSlice: FeatureLearningState | null | undefined,
): FeatureLearningState {
  if (!contextSlice) return global;
  const out = emptyFeatureLearningState();
  for (const dim of LEARNING_DIMS) {
    const g = global[dim];
    const c = contextSlice[dim];
    const keySet = new Set([...Object.keys(g), ...Object.keys(c)]);
    for (const k of keySet) {
      out[dim][k] = pickBlendedStat(c[k], g[k]);
    }
  }
  return out;
}

/**
 * Wilson score lower bound (conservative conversion rate) for binary outcomes.
 */
export function wilsonLowerBound(successes: number, trials: number, z = 1.96): number {
  if (trials <= 0) return 0.5;
  const p = successes / trials;
  const denom = 1 + (z * z) / trials;
  const centre = p + (z * z) / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * trials)) / trials);
  return Math.max(0, Math.min(1, (centre - margin) / denom));
}

/**
 * Confidence in a learned combo bucket (weighted success/fail aggregates).
 * High effective volume + tight Wilson band → high confidence.
 */
export function comboBucketConfidence(stat: FeatureStat | undefined): number {
  if (!stat) return 0;
  const tot = stat.success + stat.fail;
  if (tot < 1e-9) return 0;
  const p = Math.max(0, Math.min(1, stat.success / tot));
  const trials = Math.max(5, Math.round(tot));
  const successes = Math.max(0, Math.min(trials, Math.round(stat.success)));
  const wLow = wilsonLowerBound(successes, trials);
  const band = Math.max(0, p - wLow);
  const nFactor = 1 - Math.exp(-tot / 26);
  const stability = Math.max(0, 1 - 2.35 * band);
  return Math.max(0, Math.min(1, 0.09 + 0.91 * nFactor * stability));
}

/**
 * Selection score for tone+verb+framing triple: favors strong combos more when confident,
 * adds diversity for uncertain buckets, soft-penalizes extreme winners (anti-overfit).
 */
export function tripleComboSelectionScore(params: {
  tripleStat: FeatureStat | undefined;
  marginalBlend: number;
  biasBoost: number;
}): number {
  const s = featureScore(params.tripleStat);
  const conf = comboBucketConfidence(params.tripleStat);
  const total = featureTotal(params.tripleStat);
  const strength = s * (0.56 + 0.44 * conf);
  const diversity = 0.092 * (1 - conf);
  const overfitPenalty =
    total > 36 && s > 0.83 ? 0.085 * (s - 0.83) * Math.min(1, (total - 36) / 48) : 0;
  return (
    strength +
    diversity +
    0.1 * (params.marginalBlend - 0.5) +
    params.biasBoost -
    overfitPenalty
  );
}

/**
 * Confidence in a variant's measured score: high n + tight Wilson band → high confidence.
 */
export function variantScoreConfidence(params: {
  impressions: number;
  clicks: number;
  signups: number;
  score: number;
}): number {
  const { impressions: imp, clicks: clk, signups: sup, score } = params;
  if (imp < 1) return 0;
  const conv = Math.max(clk / imp, sup / imp, score);
  const pseudoSuccess = Math.round(conv * imp);
  const wLow = wilsonLowerBound(pseudoSuccess, imp);
  const band = Math.max(0, conv - wLow);
  const nFactor = 1 - Math.exp(-imp / 120);
  const stability = Math.max(0, 1 - 2.2 * band);
  return Math.max(0, Math.min(1, 0.15 + 0.85 * nFactor * stability));
}

export function pickFeatureValue<T extends string>(params: {
  candidates: readonly T[];
  scores: (v: T) => number;
  explorationRate: number;
  rng: () => number;
}): T {
  const { candidates, scores, explorationRate, rng } = params;
  if (candidates.length === 0) throw new Error("pickFeatureValue: empty candidates");
  if (candidates.length === 1) return candidates[0]!;
  if (rng() < explorationRate) {
    return candidates[Math.floor(rng() * candidates.length)]!;
  }
  let best = candidates[0]!;
  let bestS = scores(best);
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    const s = scores(c);
    if (s > bestS + 1e-9) {
      bestS = s;
      best = c;
    } else if (Math.abs(s - bestS) < 1e-9 && rng() < 0.5) {
      best = c;
    }
  }
  return best;
}

export function strategyFeatureBias(mode: DemoCtaStrategyMode): {
  tone: Partial<Record<string, number>>;
  framing: Partial<Record<string, number>>;
} {
  if (mode === "profit") {
    return {
      tone: { direct: 0.12, benefit: 0.1, curiosity: -0.04, urgency: 0.02 },
      framing: { result: 0.1, process: 0.02, question: -0.05 },
    };
  }
  if (mode === "growth") {
    return {
      tone: { curiosity: 0.12, benefit: 0.04, direct: -0.02, urgency: 0.02 },
      framing: { question: 0.1, process: 0.04, result: -0.02 },
    };
  }
  return { tone: {}, framing: {} };
}

export function nextExplorationRate(params: {
  prev: number;
  variantConfidences: number[];
  min?: number;
  max?: number;
}): number {
  const { prev, variantConfidences } = params;
  const min = params.min ?? 0.06;
  const max = params.max ?? 0.32;
  const arr = variantConfidences.length ? variantConfidences : [0.35];
  const avgConf = arr.reduce((a, b) => a + b, 0) / arr.length;
  const uncertain = Math.max(0, Math.min(1, 1 - avgConf));
  const target = min + (max - min) * (0.35 + 0.65 * uncertain);
  return Math.max(min, Math.min(max, 0.72 * prev + 0.28 * target));
}

function mergeDimDecay(
  prev: Record<string, FeatureStat>,
  fresh: Record<string, FeatureStat>,
  decayPrev: number,
): Record<string, FeatureStat> {
  const keys = new Set([...Object.keys(prev), ...Object.keys(fresh)]);
  const out: Record<string, FeatureStat> = {};
  for (const k of keys) {
    const p = prev[k] ?? { success: 0, fail: 0 };
    const f = fresh[k] ?? { success: 0, fail: 0 };
    out[k] = {
      success: decayPrev * p.success + (1 - decayPrev) * f.success,
      fail: decayPrev * p.fail + (1 - decayPrev) * f.fail,
    };
  }
  return out;
}

/**
 * Time decay toward freshly observed window counts (idempotent for fixed inputs).
 */
export function mergeFeatureLearningWithDecay(
  previous: FeatureLearningState,
  freshWindow: FeatureLearningState,
  decayPreviousWeight: number,
): FeatureLearningState {
  const d = Math.max(0, Math.min(1, decayPreviousWeight));
  const prev = previous ?? emptyFeatureLearningState();
  const fresh = freshWindow ?? emptyFeatureLearningState();
  return {
    tone: mergeDimDecay(prev.tone, fresh.tone, d),
    verb: mergeDimDecay(prev.verb, fresh.verb, d),
    framing: mergeDimDecay(prev.framing, fresh.framing, d),
    length: mergeDimDecay(prev.length, fresh.length, d),
    tone_verb: mergeDimDecay(prev.tone_verb ?? {}, fresh.tone_verb ?? {}, d),
    framing_tone: mergeDimDecay(prev.framing_tone ?? {}, fresh.framing_tone ?? {}, d),
    tone_verb_framing: mergeDimDecay(prev.tone_verb_framing ?? {}, fresh.tone_verb_framing ?? {}, d),
  };
}

/**
 * Objective-aware weight for how strongly a variant's outcome updates feature buckets.
 * Blends CTR, signup quality (per impression), and a conversion proxy.
 */
export function objectiveLearningWeight(imp: number, clk: number, sup: number): number {
  if (imp < 1) return 0;
  const ctr = clk / imp;
  const sur = sup / imp;
  const conv = (clk + sup) / imp;
  return 0.28 + 0.32 * ctr + 0.28 * sur + 0.12 * Math.min(1, conv);
}
