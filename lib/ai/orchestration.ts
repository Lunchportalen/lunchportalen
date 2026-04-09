import "server-only";

import { collectSignals, type PosSignalCollectionContext, type PosUnifiedSignals } from "@/lib/pos/signalCollector";
import {
  mergeTriggerHints,
  resolveDynamicPriority,
  scorePosImpacts,
  type PosTriggerHints,
} from "@/lib/pos/posAdaptive";
import { loadPosAdaptiveKnobs, persistPosAdaptiveOutcome } from "@/lib/pos/posAdaptivePersistence";
import { routeDecisions, type PosRoutedDecision } from "@/lib/pos/decisionRouter";
import { getPosDesignSystemSnapshot, routeExecution, type PosExecutionIntent } from "@/lib/pos/executionRouter";
import { routeLearning, type PosLearningContext, type PosLearningRouteResult } from "@/lib/pos/learningRouter";
import type { PosSignalPriority, PosStabilizeStats } from "@/lib/pos/posStabilizer";
import { orderSurfacesForPriority, stabilizePosDecisions } from "@/lib/pos/posStabilizer";
import type { ProductSurface } from "@/lib/pos/surfaceRegistry";
import { recordPosCycleComplete, recordPosCycleSkipped } from "@/lib/system/controlPlaneMetrics";

export type { PosSignalPriority };

export type SystemCycleContext = PosSignalCollectionContext & {
  surfaces?: ProductSurface[];
  learning?: PosLearningContext;
  /** Merged trigger types or caller label (observability only). */
  source?: string;
  /** Dominant queue priority: cms_update > ai_usage > growth (set by event handler). */
  signal_priority?: PosSignalPriority;
  /** Explicit trigger flags; merged with {@link source} when omitted. */
  trigger_hints?: PosTriggerHints;
};

export type SystemCycleResult = {
  signals: PosUnifiedSignals;
  decisions: PosRoutedDecision[];
  execution: PosExecutionIntent[];
  learning: PosLearningRouteResult;
  design_system: ReturnType<typeof getPosDesignSystemSnapshot>;
  source?: string;
  stabilization?: PosStabilizeStats;
};

function cooldownMs(): number {
  const raw = String(process.env.POS_CYCLE_COOLDOWN_MS ?? "").trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 3_600_000) return Math.floor(n);
  }
  return 5_000;
}

let cyclePromise: Promise<SystemCycleResult> | null = null;
let lastCycleCompletedAt = 0;
let lastCycleResult: SystemCycleResult | null = null;

/**
 * Product Operating System — one full pass: signals → decisions → safe execution intents → learning.
 * Single-flight: concurrent callers await the same in-flight run. Cooldown skips duplicate work (returns last result).
 */
export async function runSystemCycle(context?: SystemCycleContext): Promise<SystemCycleResult> {
  if (cyclePromise) return cyclePromise;

  const { surfaces, learning, source, signal_priority, trigger_hints, ...signalCtx } = context ?? {};
  const now = Date.now();
  const cd = cooldownMs();
  if (cd > 0 && lastCycleResult && now - lastCycleCompletedAt < cd) {
    recordPosCycleSkipped("cooldown");
    return { ...lastCycleResult, source: source ?? lastCycleResult.source };
  }

  const p = (async (): Promise<SystemCycleResult> => {
    const signals = await collectSignals(signalCtx);
    const hints = mergeTriggerHints(trigger_hints, source);
    const impacts = scorePosImpacts(signals, hints);
    const staticTier: PosSignalPriority = signal_priority ?? "growth";
    const dynamicPriority = resolveDynamicPriority(impacts, hints, staticTier);
    const orderedSurfaces =
      surfaces && surfaces.length > 0 ? orderSurfacesForPriority(surfaces, dynamicPriority) : surfaces;
    const knobs = await loadPosAdaptiveKnobs();
    const rawDecisions = routeDecisions(signals, orderedSurfaces);
    const { decisions, stats } = stabilizePosDecisions(rawDecisions, dynamicPriority, knobs);
    const execution = routeExecution(decisions);
    const learningOut = await routeLearning(signals, execution, learning);
    const design_system = getPosDesignSystemSnapshot();
    const result: SystemCycleResult = {
      signals,
      decisions,
      execution,
      learning: learningOut,
      design_system,
      source,
      stabilization: stats,
    };
    lastCycleResult = result;
    lastCycleCompletedAt = Date.now();
    const surfacesTouched = new Set<ProductSurface>();
    for (const d of decisions) {
      if (d.action !== "observe_platform_health") surfacesTouched.add(d.surface);
    }
    const actionKinds = [...new Set(execution.map((e) => e.kind))];
    recordPosCycleComplete({
      source: source ?? null,
      surfaces: [...surfacesTouched],
      executionKinds: actionKinds,
      decisionCount: decisions.length,
      signalPriority: dynamicPriority,
      skippedLowConfidence: stats.skipped_low_confidence,
      suppressedDuplicates: stats.suppressed_duplicate_actions,
      cappedSurfaces: stats.capped_inactive_surfaces,
      activeNonObserveSurfaces: stats.active_non_observe_surfaces,
      effectiveMinConfidence: stats.effective_min_confidence,
      effectiveMaxActive: stats.effective_max_active_surfaces,
    });
    void persistPosAdaptiveOutcome({
      stats,
      decisionCount: decisions.length,
      dynamicPriority,
      impacts,
      hints,
      trafficPages: signals.analytics.page_views,
      surfacesCapped: stats.surfaces_globally_capped,
      highConfidenceActiveSurfaces: stats.active_high_confidence_surfaces,
    });
    return result;
  })();

  cyclePromise = p.finally(() => {
    cyclePromise = null;
  });

  return cyclePromise;
}

/**
 * Etter vellykket {@link runAi}: kø debouncet POS-syklus (signal → beslutning → trygg utførelse → læring).
 * Tynn wrapper over `onEvent` — ingen parallell kjøring utenom {@link runSystemCycle}-lås.
 */
export function notifyPosAiUsage(companyId?: string | null, tool?: string | undefined): void {
  try {
    void import("@/lib/pos/eventHandler").then(({ onEvent }) => {
      onEvent({
        type: "ai_usage_updated",
        company_id: companyId?.trim() || undefined,
        tool: tool?.trim() || undefined,
      });
    });
  } catch {
    /* POS skal aldri påvirke runner */
  }
}
