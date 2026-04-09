import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  catalogKeysInOrder,
  defaultDemoCtaSeedCatalog,
  parseDemoCtaVariantCatalog,
  type DemoCtaCatalogEntry,
} from "@/lib/public/demoCtaAb/catalog";
import {
  DEMO_CTA_AB_CONTEXT_MIN_IMPRESSIONS,
  DEMO_CTA_AB_DEFAULT_STRATEGY_MODE,
  DEMO_CTA_AB_EXPERIMENT_KEY,
  DEMO_CTA_AB_FEATURE_LEARN_DECAY,
  DEMO_CTA_AB_HISTORY_MAX,
  DEMO_CTA_AB_MAX_GENERATED,
  DEMO_CTA_AB_MAX_VARIANTS,
  DEMO_CTA_AB_MIN_IMPRESSIONS,
  DEMO_CTA_AB_PATTERN_CONTEXT_MIN_IMPRESSIONS,
  DEMO_CTA_AB_PROMOTE_MIN_IMPRESSIONS,
  DEMO_CTA_AB_PROMOTE_MIN_SCORE,
  DEMO_CTA_AB_REBALANCE_COOLDOWN_SEC,
  DEMO_CTA_AB_SMOOTH_ALPHA,
  DEMO_CTA_AB_SPAWN_COOLDOWN_HOURS,
  DEMO_CTA_AB_SPAWN_MIN_SCORE_GAP,
  DEMO_CTA_AB_SPAWN_MIN_TOP_CONFIDENCE,
  DEMO_CTA_AB_SPAWN_STEAL_FROM_LEADER,
  DEMO_CTA_AB_STATS_DAYS,
  DEMO_CTA_AB_WEIGHT_FLOOR,
} from "@/lib/public/demoCtaAb/config";
import {
  DEMO_CTA_FEATURE_MIN_SAMPLE,
  mergeFeatureLearningWithDecay,
  nextExplorationRate,
  objectiveLearningWeight,
  variantScoreConfidence,
} from "@/lib/public/demoCtaAb/featureScoring";
import { inferDemoCtaFeaturesFromLabel } from "@/lib/public/demoCtaAb/inferFeatures";
import {
  allDemoCtaPatternContextKeys,
  parseDemoCtaPatternContextKey,
  parsePatternLearningByContext,
} from "@/lib/public/demoCtaAb/patternContext";
import {
  demoCtaFramingToneKey,
  demoCtaToneVerbKey,
  demoCtaTripleKey,
  emptyFeatureLearningState,
  isDemoCtaStrategyMode,
  parseFeatureLearningState,
  parseVariantPerformanceHistory,
  type DemoCtaStrategyMode,
  type FeatureLearningState,
  type FeatureStat,
  type VariantPerformanceSnapshot,
} from "@/lib/public/demoCtaAb/types";
import { nextGeneratedVariantId } from "@/lib/public/demoCtaAb/variantId";
import {
  alignWeightsToCatalogKeys,
  clampDemoCtaWeightsForKeys,
  normalizeDemoCtaWeightsForKeys,
  winningDemoCtaVariant,
  type DemoCtaWeights,
} from "@/lib/public/demoCtaAb/weights";
import {
  generateVariantFromLearning,
  proposeDemoCtaLabelFromWinners,
} from "@/lib/server/demoCtaAb/candidateCtaLabels";

async function countDemoAb(
  supabase: SupabaseClient,
  env: "prod" | "staging",
  sinceIso: string,
  eventType: "page_view" | "cta_click",
  eventKey: string | string[],
  ctaAb: string,
  ctx?: { device_seg: string; source_seg?: string; intent_seg?: string },
): Promise<number> {
  const keys = Array.isArray(eventKey) ? eventKey : [eventKey];
  const meta: Record<string, string> = { cta_ab: ctaAb };
  if (ctx) {
    meta.device_seg = ctx.device_seg;
    if (ctx.source_seg !== undefined && ctx.source_seg !== "") meta.source_seg = ctx.source_seg;
    if (ctx.intent_seg) meta.intent_seg = ctx.intent_seg;
  }
  let q = supabase
    .from("content_analytics_events")
    .select("*", { count: "exact", head: true })
    .eq("environment", env)
    .eq("locale", "nb")
    .eq("event_type", eventType)
    .contains("metadata", meta)
    .gte("created_at", sinceIso);
  if (keys.length === 1) {
    q = q.eq("event_key", keys[0]!);
  } else {
    q = q.in("event_key", keys);
  }
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function scoreVariant(imp: number, clicks: number, signups: number): number {
  if (imp < 1) return 0;
  const ctr = clicks / imp;
  const sur = signups / imp;
  return 0.45 * ctr + 0.55 * sur;
}

function bumpFeatureStat(dim: Record<string, FeatureStat>, key: string, succ: number, fail: number) {
  if (!dim[key]) dim[key] = { success: 0, fail: 0 };
  dim[key]!.success += succ;
  dim[key]!.fail += fail;
}

function medianVariantScore(
  keys: string[],
  stats: Record<string, { imp: number; clk: number; sup: number }>,
): number {
  const scores = keys
    .map((k) => stats[k]!)
    .filter((s) => s.imp >= DEMO_CTA_FEATURE_MIN_SAMPLE)
    .map((s) => scoreVariant(s.imp, s.clk, s.sup))
    .sort((a, b) => a - b);
  if (!scores.length) return 0;
  const mid = Math.floor(scores.length / 2);
  return scores.length % 2 ? scores[mid]! : (scores[mid - 1]! + scores[mid]!) / 2;
}

function computeFreshFeatureLearningWindow(
  catalog: Record<string, DemoCtaCatalogEntry>,
  stats: Record<string, { imp: number; clk: number; sup: number }>,
  keys: string[],
  median: number,
): FeatureLearningState {
  const fresh = emptyFeatureLearningState();
  for (const k of keys) {
    const st = stats[k]!;
    if (st.imp < DEMO_CTA_FEATURE_MIN_SAMPLE) continue;
    const sc = scoreVariant(st.imp, st.clk, st.sup);
    const entry = catalog[k];
    if (!entry) continue;
    const feats = entry.features ?? inferDemoCtaFeaturesFromLabel(entry.label);
    const w = objectiveLearningWeight(st.imp, st.clk, st.sup);
    const isWin = sc >= median;
    const succ = isWin ? w : 0;
    const fail = isWin ? 0 : w;
    bumpFeatureStat(fresh.tone, feats.tone, succ, fail);
    bumpFeatureStat(fresh.verb, feats.verb, succ, fail);
    bumpFeatureStat(fresh.framing, feats.framing, succ, fail);
    bumpFeatureStat(fresh.length, feats.length, succ, fail);
    bumpFeatureStat(fresh.tone_verb, demoCtaToneVerbKey(feats.tone, feats.verb), succ, fail);
    bumpFeatureStat(fresh.framing_tone, demoCtaFramingToneKey(feats.framing, feats.tone), succ, fail);
    bumpFeatureStat(
      fresh.tone_verb_framing,
      demoCtaTripleKey(feats.tone, feats.verb, feats.framing),
      succ,
      fail,
    );
  }
  return fresh;
}

function resolveStrategyMode(raw: unknown): DemoCtaStrategyMode {
  const s = typeof raw === "string" ? raw : "";
  if (isDemoCtaStrategyMode(s)) return s;
  const env =
    typeof process.env.DEMO_CTA_AB_STRATEGY_MODE === "string" ? process.env.DEMO_CTA_AB_STRATEGY_MODE.trim() : "";
  if (isDemoCtaStrategyMode(env)) return env;
  return DEMO_CTA_AB_DEFAULT_STRATEGY_MODE;
}

function appendPerformanceHistory(
  prev: VariantPerformanceSnapshot[],
  params: {
    keys: string[];
    stats: Record<string, { imp: number; clk: number; sup: number }>;
    catalog: Record<string, DemoCtaCatalogEntry>;
    atIso: string;
  },
): VariantPerformanceSnapshot[] {
  const next = [...prev];
  for (const k of params.keys) {
    const st = params.stats[k]!;
    if (st.imp < 1) continue;
    const sc = scoreVariant(st.imp, st.clk, st.sup);
    const conf = variantScoreConfidence({
      impressions: st.imp,
      clicks: st.clk,
      signups: st.sup,
      score: sc,
    });
    const feats = params.catalog[k]?.features;
    next.push({
      at: params.atIso,
      variantKey: k,
      score: sc,
      impressions: st.imp,
      confidence: conf,
      ...(feats ? { features: feats } : {}),
    });
  }
  const overflow = Math.max(0, next.length - DEMO_CTA_AB_HISTORY_MAX);
  return overflow ? next.slice(overflow) : next;
}

async function loadBucketStats(
  supabase: SupabaseClient,
  env: "prod" | "staging",
  sinceIso: string,
  variantKeys: string[],
  ctx?: { device_seg: string; source_seg?: string; intent_seg?: string },
): Promise<Record<string, { imp: number; clk: number; sup: number }>> {
  const stats: Record<string, { imp: number; clk: number; sup: number }> = {};
  for (const k of variantKeys) {
    stats[k] = { imp: 0, clk: 0, sup: 0 };
  }
  for (const k of variantKeys) {
    stats[k]!.imp = await countDemoAb(supabase, env, sinceIso, "page_view", "ai_demo_view", k, ctx);
    stats[k]!.clk = await countDemoAb(
      supabase,
      env,
      sinceIso,
      "cta_click",
      ["ai_demo_try_own", "ai_demo_onboarding_entry", "ai_demo_try_own_inline"],
      k,
      ctx,
    );
    stats[k]!.sup = await countDemoAb(supabase, env, sinceIso, "page_view", "signup_from_ai_demo", k, ctx);
  }
  return stats;
}

function seedKeysOf(catalog: Record<string, DemoCtaCatalogEntry>, keys: string[]): string[] {
  return keys.filter((k) => catalog[k]?.kind === "seed");
}

function generatedKeysOf(catalog: Record<string, DemoCtaCatalogEntry>, keys: string[]): string[] {
  return keys.filter((k) => catalog[k]?.kind === "generated");
}

function targetWeightsFromStats(
  stats: Record<string, { imp: number; clk: number; sup: number }>,
  prev: DemoCtaWeights,
  keys: string[],
): DemoCtaWeights {
  const raw: DemoCtaWeights = {};
  let sum = 0;
  for (const k of keys) {
    const { imp, clk, sup } = stats[k] ?? { imp: 0, clk: 0, sup: 0 };
    const s =
      imp >= DEMO_CTA_AB_MIN_IMPRESSIONS ? scoreVariant(imp, clk, sup) : Math.max(1e-9, prev[k] ?? 1 / keys.length);
    raw[k] = s;
    sum += s;
  }
  const out: DemoCtaWeights = {};
  if (sum <= 0) {
    const u = 1 / keys.length;
    for (const k of keys) out[k] = u;
    return out;
  }
  for (const k of keys) out[k] = (raw[k] ?? 0) / sum;
  return out;
}

function redistributeAfterRemove(weights: DemoCtaWeights, keys: string[], remove: string): DemoCtaWeights {
  const nextKeys = keys.filter((k) => k !== remove);
  if (nextKeys.length === 0) return { a: 0.5, b: 0.5 };
  const wRem = weights[remove] ?? 0;
  const base: DemoCtaWeights = {};
  let s = 0;
  for (const k of nextKeys) {
    base[k] = weights[k] ?? 0;
    s += base[k]!;
  }
  const out: DemoCtaWeights = {};
  if (s <= 0) {
    const u = 1 / nextKeys.length;
    for (const k of nextKeys) out[k] = u;
    return normalizeDemoCtaWeightsForKeys(out, nextKeys);
  }
  for (const k of nextKeys) {
    out[k] = (base[k]! / s) * (1 + wRem);
  }
  return normalizeDemoCtaWeightsForKeys(out, nextKeys);
}

async function syncAllContextWeightsToCatalog(
  supabase: SupabaseClient,
  catalog: Record<string, DemoCtaCatalogEntry>,
  globalW: DemoCtaWeights,
): Promise<void> {
  const keys = catalogKeysInOrder(catalog);
  const { data: rows, error } = await supabase
    .from("ai_demo_ab_context_state")
    .select("device_seg,source_seg,intent_seg,weights")
    .eq("experiment_key", DEMO_CTA_AB_EXPERIMENT_KEY);
  if (error || !rows?.length) return;
  const nowIso = new Date().toISOString();
  for (const r of rows) {
    const device_seg = String(r.device_seg ?? "");
    const source_seg = String(r.source_seg ?? "");
    const intent_seg = String(r.intent_seg ?? "demo_auto");
    if (!device_seg || !source_seg) continue;
    const aligned = alignWeightsToCatalogKeys(r.weights, catalog, globalW);
    const clamped = clampDemoCtaWeightsForKeys(aligned, keys, DEMO_CTA_AB_WEIGHT_FLOOR);
    await supabase
      .from("ai_demo_ab_context_state")
      .update({ weights: clamped, updated_at: nowIso })
      .eq("experiment_key", DEMO_CTA_AB_EXPERIMENT_KEY)
      .eq("device_seg", device_seg)
      .eq("source_seg", source_seg)
      .eq("intent_seg", intent_seg);
  }
}

/**
 * Global A/B-vekter + variantkatalog (frø + genererte tekster).
 */
export async function maybeRebalanceDemoCtaWeights(supabase: SupabaseClient, env: "prod" | "staging"): Promise<void> {
  const now = Date.now();
  const since = new Date(now - DEMO_CTA_AB_STATS_DAYS * 86_400_000).toISOString();

  const { data: row, error: readErr } = await supabase
    .from("ai_demo_cta_ab_state")
    .select(
      "weights,variant_catalog,last_rebalanced_at,last_spawn_at,feature_learning,exploration_rate,variant_performance_history,strategy_mode,pattern_learning_by_context",
    )
    .eq("experiment_key", DEMO_CTA_AB_EXPERIMENT_KEY)
    .maybeSingle();

  if (readErr) return;
  if (!row) return;

  let catalog: Record<string, DemoCtaCatalogEntry> =
    parseDemoCtaVariantCatalog(row.variant_catalog) ?? defaultDemoCtaSeedCatalog();
  let keys = catalogKeysInOrder(catalog);
  const catalogBefore = JSON.stringify(catalog);

  if (!parseDemoCtaVariantCatalog(row.variant_catalog)) {
    await supabase
      .from("ai_demo_cta_ab_state")
      .update({ variant_catalog: catalog, updated_at: new Date(now).toISOString() })
      .eq("experiment_key", DEMO_CTA_AB_EXPERIMENT_KEY);
  }

  const last = row.last_rebalanced_at ? new Date(String(row.last_rebalanced_at)).getTime() : 0;
  if (now - last < DEMO_CTA_AB_REBALANCE_COOLDOWN_SEC * 1000) return;

  const prev = clampDemoCtaWeightsForKeys(
    normalizeDemoCtaWeightsForKeys(row.weights, keys),
    keys,
    DEMO_CTA_AB_WEIGHT_FLOOR,
  );

  const stats = await loadBucketStats(supabase, env, since, keys, undefined);
  const sk = seedKeysOf(catalog, keys);
  const minSeedImp = sk.length ? Math.min(...sk.map((k) => stats[k]!.imp)) : 0;

  if (minSeedImp < DEMO_CTA_AB_MIN_IMPRESSIONS) {
    await supabase
      .from("ai_demo_cta_ab_state")
      .update({ last_rebalanced_at: new Date(now).toISOString() })
      .eq("experiment_key", DEMO_CTA_AB_EXPERIMENT_KEY);
    return;
  }

  const prevLearning = parseFeatureLearningState(row.feature_learning);
  const strategyMode = resolveStrategyMode(row.strategy_mode);
  const prevExploration =
    typeof row.exploration_rate === "number" && Number.isFinite(row.exploration_rate)
      ? row.exploration_rate
      : 0.14;
  const prevHistory = parseVariantPerformanceHistory(row.variant_performance_history);
  const medianS = medianVariantScore(keys, stats);
  const freshLearning = computeFreshFeatureLearningWindow(catalog, stats, keys, medianS);
  const featureLearning = mergeFeatureLearningWithDecay(
    prevLearning,
    freshLearning,
    DEMO_CTA_AB_FEATURE_LEARN_DECAY,
  );

  const prevPatternByContext = parsePatternLearningByContext(row.pattern_learning_by_context);
  const nextPatternByContext: Record<string, FeatureLearningState> = { ...prevPatternByContext };
  const patternStatsCache = new Map<string, Record<string, { imp: number; clk: number; sup: number }>>();
  for (const ck of allDemoCtaPatternContextKeys()) {
    const parsed = parseDemoCtaPatternContextKey(ck);
    if (!parsed) continue;
    const statsCtx = await loadBucketStats(supabase, env, since, keys, {
      device_seg: parsed.device_seg,
      intent_seg: parsed.intent_seg,
    });
    patternStatsCache.set(ck, statsCtx);
    const medianCtx = medianVariantScore(keys, statsCtx);
    const freshCtx = computeFreshFeatureLearningWindow(catalog, statsCtx, keys, medianCtx);
    const prevCtx = nextPatternByContext[ck] ?? emptyFeatureLearningState();
    nextPatternByContext[ck] = mergeFeatureLearningWithDecay(prevCtx, freshCtx, DEMO_CTA_AB_FEATURE_LEARN_DECAY);
  }

  const confidencesAll = keys.map((k) => {
    const st = stats[k]!;
    const sc = scoreVariant(st.imp, st.clk, st.sup);
    return variantScoreConfidence({
      impressions: st.imp,
      clicks: st.clk,
      signups: st.sup,
      score: sc,
    });
  });
  const explorationRate = nextExplorationRate({ prev: prevExploration, variantConfidences: confidencesAll });

  const target = targetWeightsFromStats(stats, prev, keys);

  let next = clampDemoCtaWeightsForKeys(
    Object.fromEntries(
      keys.map((k) => [k, (1 - DEMO_CTA_AB_SMOOTH_ALPHA) * (prev[k] ?? 0) + DEMO_CTA_AB_SMOOTH_ALPHA * (target[k] ?? 0)]),
    ) as DemoCtaWeights,
    keys,
    DEMO_CTA_AB_WEIGHT_FLOOR,
  );

  for (const k of generatedKeysOf(catalog, keys)) {
    const st = stats[k]!;
    if (st.imp < DEMO_CTA_AB_PROMOTE_MIN_IMPRESSIONS) continue;
    const sc = scoreVariant(st.imp, st.clk, st.sup);
    if (sc < DEMO_CTA_AB_PROMOTE_MIN_SCORE) continue;
    const ent = catalog[k];
    if (!ent || ent.kind !== "generated") continue;
    catalog = { ...catalog, [k]: { ...ent, kind: "seed" } };
  }

  const scored = keys.map((k) => ({
    k,
    s: scoreVariant(stats[k]!.imp, stats[k]!.clk, stats[k]!.sup),
  }));
  scored.sort((x, y) => y.s - x.s);
  const top = scored[0];
  const second = scored[1] ?? top;
  const gap =
    top && second && top.s >= 1e-6 && second
      ? top.s - second.s
      : top && top.s >= 1e-6
        ? top.s
        : 0;

  const topConf =
    top && stats[top.k] && stats[top.k]!.imp >= 1
      ? variantScoreConfidence({
          impressions: stats[top.k]!.imp,
          clicks: stats[top.k]!.clk,
          signups: stats[top.k]!.sup,
          score: top.s,
        })
      : 0;

  const generated = generatedKeysOf(catalog, keys);
  const lastSpawn = row.last_spawn_at ? new Date(String(row.last_spawn_at)).getTime() : 0;
  const spawnCooldownOk = now - lastSpawn >= DEMO_CTA_AB_SPAWN_COOLDOWN_HOURS * 3_600_000;
  const canSpawn =
    spawnCooldownOk &&
    generated.length < DEMO_CTA_AB_MAX_GENERATED &&
    keys.length < DEMO_CTA_AB_MAX_VARIANTS &&
    gap >= DEMO_CTA_AB_SPAWN_MIN_SCORE_GAP &&
    top &&
    stats[top.k]!.imp >= DEMO_CTA_AB_MIN_IMPRESSIONS &&
    topConf >= DEMO_CTA_AB_SPAWN_MIN_TOP_CONFIDENCE;

  let spawnIso: string | null = null;
  if (canSpawn && top && second) {
    let spawnPatternCtx: string | undefined;
    let maxPatternTot = 0;
    for (const ck of allDemoCtaPatternContextKeys()) {
      const st = patternStatsCache.get(ck);
      if (!st) continue;
      const tot = keys.reduce((sum, kk) => sum + st[kk]!.imp, 0);
      if (tot >= DEMO_CTA_AB_PATTERN_CONTEXT_MIN_IMPRESSIONS && tot > maxPatternTot) {
        maxPatternTot = tot;
        spawnPatternCtx = ck;
      }
    }
    const newId = nextGeneratedVariantId(keys);
    const learned = generateVariantFromLearning({
      learning: featureLearning,
      patternLearningByContext: nextPatternByContext,
      patternContextKey: spawnPatternCtx ?? null,
      strategyMode,
      explorationRate,
      newVariantId: newId,
    });
    let label = learned.label;
    if (label.length < 10) {
      label = proposeDemoCtaLabelFromWinners({
        topLabel: catalog[top.k]!.label,
        runnerUpLabel: catalog[second.k]!.label,
        newVariantId: newId,
      });
    }
    const feats =
      label === learned.label ? learned.features : inferDemoCtaFeaturesFromLabel(label);
    catalog = {
      ...catalog,
      [newId]: { label, kind: "generated", parent: top.k, features: feats },
    };
    keys = catalogKeysInOrder(catalog);
    const steal = DEMO_CTA_AB_SPAWN_STEAL_FROM_LEADER;
    const leader = top.k;
    const expanded: DemoCtaWeights = { ...next };
    for (const k of keys) {
      if (!(k in expanded)) expanded[k] = DEMO_CTA_AB_WEIGHT_FLOOR;
    }
    const leaderW = expanded[leader] ?? 0;
    expanded[leader] = Math.max(DEMO_CTA_AB_WEIGHT_FLOOR, leaderW * (1 - steal));
    expanded[newId] = steal;
    next = clampDemoCtaWeightsForKeys(
      normalizeDemoCtaWeightsForKeys(expanded, keys),
      keys,
      DEMO_CTA_AB_WEIGHT_FLOOR,
    );
    spawnIso = new Date(now).toISOString();
  }

  if (keys.length > DEMO_CTA_AB_MAX_VARIANTS) {
    const gen = generatedKeysOf(catalog, keys);
    let worst: string | null = null;
    let worstScore = Infinity;
    for (const k of gen) {
      const sc = scoreVariant(stats[k]!.imp, stats[k]!.clk, stats[k]!.sup);
      const penal = stats[k]!.imp < DEMO_CTA_AB_CONTEXT_MIN_IMPRESSIONS ? sc - 0.02 : sc;
      if (penal < worstScore) {
        worstScore = penal;
        worst = k;
      }
    }
    if (worst) {
      const { [worst]: _removed, ...restCat } = catalog;
      catalog = restCat;
      keys = catalogKeysInOrder(catalog);
      next = clampDemoCtaWeightsForKeys(
        redistributeAfterRemove(next, Object.keys(next), worst),
        keys,
        DEMO_CTA_AB_WEIGHT_FLOOR,
      );
    }
  }

  const atIso = new Date(now).toISOString();
  const performanceHistory = appendPerformanceHistory(prevHistory, {
    keys,
    stats,
    catalog,
    atIso,
  });

  await supabase
    .from("ai_demo_cta_ab_state")
    .update({
      weights: next,
      variant_catalog: catalog,
      feature_learning: featureLearning,
      pattern_learning_by_context: nextPatternByContext,
      exploration_rate: explorationRate,
      variant_performance_history: performanceHistory,
      last_rebalanced_at: atIso,
      updated_at: atIso,
      ...(spawnIso ? { last_spawn_at: spawnIso } : {}),
    })
    .eq("experiment_key", DEMO_CTA_AB_EXPERIMENT_KEY);

  if (JSON.stringify(catalog) !== catalogBefore) {
    await syncAllContextWeightsToCatalog(supabase, catalog, next);
  }
}

/**
 * Per kontekst (device_seg × source_seg × intent_seg).
 */
export async function maybeRebalanceDemoCtaContextWeights(
  supabase: SupabaseClient,
  env: "prod" | "staging",
): Promise<void> {
  const now = Date.now();
  const since = new Date(now - DEMO_CTA_AB_STATS_DAYS * 86_400_000).toISOString();

  const { data: globalRow } = await supabase
    .from("ai_demo_cta_ab_state")
    .select("weights,variant_catalog")
    .eq("experiment_key", DEMO_CTA_AB_EXPERIMENT_KEY)
    .maybeSingle();

  const catalog: Record<string, DemoCtaCatalogEntry> =
    parseDemoCtaVariantCatalog(globalRow?.variant_catalog) ?? defaultDemoCtaSeedCatalog();
  const keys = catalogKeysInOrder(catalog);
  const globalW = clampDemoCtaWeightsForKeys(
    normalizeDemoCtaWeightsForKeys(globalRow?.weights, keys),
    keys,
    DEMO_CTA_AB_WEIGHT_FLOOR,
  );

  const { data: rows, error: listErr } = await supabase
    .from("ai_demo_ab_context_state")
    .select("device_seg,source_seg,intent_seg,weights,last_rebalanced_at")
    .eq("experiment_key", DEMO_CTA_AB_EXPERIMENT_KEY);

  if (listErr || !rows?.length) return;

  const statsCache = new Map<string, Record<string, { imp: number; clk: number; sup: number }>>();

  for (const r of rows) {
    const device_seg = String(r.device_seg ?? "");
    const source_seg = String(r.source_seg ?? "");
    const intent_seg = String(r.intent_seg ?? "demo_auto");
    if (!device_seg || !source_seg) continue;

    const last = r.last_rebalanced_at ? new Date(String(r.last_rebalanced_at)).getTime() : 0;
    if (now - last < DEMO_CTA_AB_REBALANCE_COOLDOWN_SEC * 1000) continue;

    const ctx = { device_seg, source_seg };
    const prev = clampDemoCtaWeightsForKeys(
      alignWeightsToCatalogKeys(r.weights, catalog, globalW),
      keys,
      DEMO_CTA_AB_WEIGHT_FLOOR,
    );

    const cacheKey = `${device_seg}|${source_seg}`;
    let stats = statsCache.get(cacheKey);
    if (!stats) {
      stats = await loadBucketStats(supabase, env, since, keys, ctx);
      statsCache.set(cacheKey, stats);
    }
    const sk = seedKeysOf(catalog, keys);
    const minSeedImp = sk.length ? Math.min(...sk.map((k) => stats[k]!.imp)) : 0;
    const totalImp = keys.reduce((s, k) => s + stats[k]!.imp, 0);

    if (minSeedImp < DEMO_CTA_AB_CONTEXT_MIN_IMPRESSIONS) {
      await supabase
        .from("ai_demo_ab_context_state")
        .update({ last_rebalanced_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
        .eq("experiment_key", DEMO_CTA_AB_EXPERIMENT_KEY)
        .eq("device_seg", device_seg)
        .eq("source_seg", source_seg)
        .eq("intent_seg", intent_seg);
      continue;
    }

    const target = targetWeightsFromStats(stats, prev, keys);

    const next = clampDemoCtaWeightsForKeys(
      Object.fromEntries(
        keys.map((k) => [k, (1 - DEMO_CTA_AB_SMOOTH_ALPHA) * (prev[k] ?? 0) + DEMO_CTA_AB_SMOOTH_ALPHA * (target[k] ?? 0)]),
      ) as DemoCtaWeights,
      keys,
      DEMO_CTA_AB_WEIGHT_FLOOR,
    );

    const win = winningDemoCtaVariant(next, keys);

    await supabase
      .from("ai_demo_ab_context_state")
      .update({
        weights: next,
        winning_variant: win,
        impressions_total: totalImp,
        last_rebalanced_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
      })
      .eq("experiment_key", DEMO_CTA_AB_EXPERIMENT_KEY)
      .eq("device_seg", device_seg)
      .eq("source_seg", source_seg)
      .eq("intent_seg", intent_seg);
  }
}

export async function runDemoCtaAbRebalancePipeline(supabase: SupabaseClient, env: "prod" | "staging"): Promise<void> {
  await maybeRebalanceDemoCtaWeights(supabase, env);
  await maybeRebalanceDemoCtaContextWeights(supabase, env);
}
