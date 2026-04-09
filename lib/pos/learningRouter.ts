import "server-only";

import {
  extractLearningSignals,
  type ExperimentLearningInput,
  type LearningSignalPayload,
  type LearningSignalsResult,
} from "@/lib/ai/feedback";
import { storeLearning } from "@/lib/ai/learning";
import type { ExperimentResults } from "@/lib/experiments/types";

import { proposeCrossSurfaceRollouts, type CrossSurfacePromotion } from "@/lib/pos/crossSurfaceLearning";
import type { PosExecutionIntent } from "@/lib/pos/executionRouter";
import type { PosUnifiedSignals } from "@/lib/pos/signalCollector";
import type { ProductSurface } from "@/lib/pos/surfaceRegistry";

export type PosLearningContext = {
  /** When set, derive feature / combo signals via {@link extractLearningSignals}. */
  experiment?: ExperimentLearningInput;
  /** Optional: promote winning pattern from this surface. */
  winning_pattern_source_surface?: ProductSurface;
  winning_pattern_key?: string;
  cross_surface_targets?: ProductSurface[];
  /**
   * When true, persist pattern weights via {@link storeLearning} (existing table — no schema change).
   * Default false: POS returns proposals only.
   */
  persist_pattern_weights?: boolean;
};

export type PosLearningRouteResult = {
  extracted_signals: LearningSignalsResult | null;
  cross_surface_promotions: CrossSurfacePromotion[];
  pattern_store: { ok: true } | { ok: false; error: string } | null;
  notes: string[];
};

function inferPatternKeyFromSignals(s: LearningSignalsResult | null): string | null {
  const w = s?.winningPatterns?.[0];
  return w?.patternKey ? String(w.patternKey) : null;
}

function buildPosCycleLearningSignals(execution: PosExecutionIntent[]): LearningSignalsResult | null {
  const winningPatterns: LearningSignalPayload[] = [];
  const cap = 6;
  let n = 0;
  for (const e of execution) {
    if (n >= cap) break;
    if (e.kind !== "editor_suggestion_only" && e.kind !== "generate_variant_preview") continue;
    if (!e.policy_allowed) continue;
    winningPatterns.push({
      patternKey: `pos_cross:${e.surface}:suggest_mark`,
      direction: "positive",
      reason: `POS cycle ${e.kind} (${e.surface})`,
      basedOn: ["cro_rules"],
      confidence: 0.12,
    });
    n += 1;
  }
  if (winningPatterns.length === 0) return null;
  return {
    winningPatterns,
    losingPatterns: [],
    metricsSummary: {
      winnerVariantId: null,
      variantCount: 0,
      totalViews: 0,
      bestConversionRate: 0,
      conversionSpread: null,
    },
  };
}

/**
 * Connects experiment feedback extraction, optional pattern persistence, and cross-surface promotion proposals.
 * Does not write CMS content. DB writes only when `persist_pattern_weights` is true (uses existing `storeLearning`).
 */
export async function routeLearning(
  _signals: PosUnifiedSignals,
  execution: PosExecutionIntent[],
  ctx?: PosLearningContext,
): Promise<PosLearningRouteResult> {
  const notes: string[] = [];
  let extracted_signals: LearningSignalsResult | null = null;

  if (ctx?.experiment?.results) {
    try {
      extracted_signals = extractLearningSignals(ctx.experiment);
    } catch (e) {
      notes.push(`extractLearningSignals_failed:${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const key =
    (ctx?.winning_pattern_key && String(ctx.winning_pattern_key).trim()) ||
    inferPatternKeyFromSignals(extracted_signals);
  const fromSurface = ctx?.winning_pattern_source_surface ?? "public_demo";

  const cross_surface_promotions =
    key && fromSurface
      ? proposeCrossSurfaceRollouts(fromSurface, key, ctx?.cross_surface_targets)
      : [];

  let pattern_store: PosLearningRouteResult["pattern_store"] = null;
  if (ctx?.persist_pattern_weights === true && extracted_signals) {
    pattern_store = await storeLearning(extracted_signals);
  } else if (extracted_signals && !ctx?.persist_pattern_weights) {
    notes.push("pattern_weights_not_persisted: persist_pattern_weights=false");
  }

  const highIntent = execution.filter((e) => e.kind === "editor_suggestion_only" || e.kind === "generate_variant_preview");
  if (highIntent.length) {
    notes.push(`execution_hints:${highIntent.length}_surfaces_with_suggestion_or_variant_preview`);
  }

  const persistCycle = /^1|true|yes$/i.test(String(process.env.LP_POS_CYCLE_LEARNING_PERSIST ?? "").trim());
  if (persistCycle && pattern_store == null) {
    const cycleSig = buildPosCycleLearningSignals(execution);
    if (cycleSig) {
      pattern_store = await storeLearning(cycleSig);
      notes.push("pos_cycle_pattern_store:LP_POS_CYCLE_LEARNING_PERSIST");
    }
  }

  return {
    extracted_signals,
    cross_surface_promotions,
    pattern_store,
    notes,
  };
}

/** Typed helper when caller already has {@link ExperimentResults} + variant blocks map. */
export function buildExperimentLearningInput(
  results: ExperimentResults,
  variantBlocks?: Record<string, unknown[]>,
  cmsSurface?: ExperimentLearningInput["cmsSurface"],
): ExperimentLearningInput {
  return { results, variantBlocks, cmsSurface };
}
