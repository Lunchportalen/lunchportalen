import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { analyzeSystem } from "@/lib/autonomy/analyze";
import { attribute } from "@/lib/autonomy/attribution";
import { predictiveDecisions, scoreActions } from "@/lib/autonomy/decisions";
import { execute } from "@/lib/autonomy/execute";
import { extractFeatures } from "@/lib/autonomy/features";
import type { ScoredAutonomyAction } from "@/lib/autonomy/growthTypes";
import { getDataset, getSeries, storeOutcome, storeSnapshot } from "@/lib/autonomy/learning";
import { trainModel, type AutonomyModel } from "@/lib/autonomy/model";
import { predictBestAction } from "@/lib/autonomy/predict";
import { isAllowed } from "@/lib/autonomy/safety";
import { deriveSignals } from "@/lib/autonomy/signals";
import { simulate } from "@/lib/autonomy/simulate";
import { collectMetrics } from "@/lib/metrics/collect";
import { extractTemporalFeatures } from "@/lib/neural/features";
import { evaluatePolicy } from "@/lib/neural/model";
import { getSequence, pushState } from "@/lib/neural/sequence";
import { selectAction } from "@/lib/neural/select";
import { updatePolicy } from "@/lib/neural/update";
import type { Database } from "@/lib/types/database";
import type { SystemSettings } from "@/lib/system/settings";

export type RunAutonomyResult =
  | { applied: ScoredAutonomyAction[]; skipped: "AUTONOMY_DISABLED" }
  | { applied: ScoredAutonomyAction[]; skipped: "SYSTEM_HALTED" }
  | { applied: ScoredAutonomyAction[]; signals: ReturnType<typeof deriveSignals> };

/** After global score sort, keep highest-scoring candidate per action type (predictive + learned may overlap). */
function dedupeByTypeDescendingScore(sorted: ScoredAutonomyAction[]): ScoredAutonomyAction[] {
  const seen = new Set<string>();
  const out: ScoredAutonomyAction[] = [];
  for (const a of sorted) {
    if (seen.has(a.type)) continue;
    seen.add(a.type);
    out.push(a);
  }
  return out;
}

/**
 * Hybrid autonomy: time-series → analysis → predictive + rules → learned rank → merge → safety → simulate → execute → outcomes.
 * No schema writes; execution is log + audit only (see execute).
 */
export async function runAutonomy(
  sb: SupabaseClient<Database>,
  settings: SystemSettings | null,
): Promise<RunAutonomyResult> {
  if (!settings?.toggles?.autonomy_master_enabled) {
    return { applied: [], skipped: "AUTONOMY_DISABLED" };
  }

  if (settings.killswitch?.global === true) {
    return { applied: [], skipped: "SYSTEM_HALTED" };
  }

  const before = await collectMetrics(sb);
  storeSnapshot(before);
  const series = getSeries();
  const analysis = analyzeSystem(series);

  const signals = deriveSignals(before);
  const actions = scoreActions(signals);

  const seq = getSequence();
  const neuralFeatures = extractTemporalFeatures(seq);
  if (neuralFeatures) {
    const scores = evaluatePolicy(neuralFeatures);
    const chosen = selectAction(scores);
    if (chosen === "price_drop" || chosen === "activate_ads") {
      // eslint-disable-next-line no-console
      console.log("[NEURAL_DECISION]", {
        features: neuralFeatures,
        scores,
        chosen,
      });
      if (chosen === "price_drop") {
        actions.unshift({ type: "price_drop", score: 1, change: -5, reason: "neural policy" });
      } else {
        actions.unshift({ type: "activate_ads", score: 1, reason: "neural policy" });
      }
    }
  }

  const dataset = getDataset();
  let learned: ScoredAutonomyAction[];
  let model: AutonomyModel | null = null;

  if (!dataset.length) {
    learned = actions;
  } else {
    try {
      model = trainModel(dataset);
      learned = predictBestAction(model, actions);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[AUTONOMY_ML_FALLBACK]", e);
      learned = actions;
      model = null;
    }
  }

  const predicted = predictiveDecisions(analysis);
  const merged = [...predicted, ...learned];
  merged.sort((a, b) => b.score - a.score);
  const ranked = dedupeByTypeDescendingScore(merged);

  // eslint-disable-next-line no-console
  console.log("[PREDICTIVE_DECISION]", {
    analysis,
    chosen: ranked[0] ?? null,
  });

  const applied: ScoredAutonomyAction[] = [];

  for (const action of ranked) {
    const w = model?.weights[action.type];
    const usedLearning = Boolean(dataset.length && model);
    // eslint-disable-next-line no-console
    console.log("[ML_DECISION]", {
      action,
      score: w?.score,
      weight: w,
      features: extractFeatures(before),
      reason: action.reason ?? (usedLearning ? "learned preference" : "rules fallback"),
    });

    if (!isAllowed(settings, action)) continue;

    const sim = simulate(action, before);
    if (!sim.safe) continue;

    const result = await execute(sb, action);
    if (!result.success) continue;

    applied.push(action);
  }

  const after = await collectMetrics(sb);

  for (const action of applied) {
    const outcome = attribute(action, before, after);
    storeOutcome(action, outcome, before);
    const reward = outcome.deltaConversion || 0;
    updatePolicy(action.type, reward);
  }

  return { applied, signals };
}
