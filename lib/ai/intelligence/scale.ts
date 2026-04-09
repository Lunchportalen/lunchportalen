/**
 * Controlled scale orchestrator — one brain ({@link getSystemIntelligence}), policy engine, intelligence store logging.
 */

import "server-only";

import type { DesignSettingsDocument } from "@/lib/cms/design/designContract";
import { isScaleAutomationEnabled } from "@/lib/core/featureFlags";
import { opsLog } from "@/lib/ops/log";

import { recordLearningOutcome } from "./learning";
import { detectPatternsFromSystemIntelligence, type PatternDetectionOutput } from "./patterns";
import { logEvent } from "./store";
import type { IntelligenceEvent, SystemIntelligence } from "./types";
import { buildDesignPatchFromScaleActions } from "./scaleApply";
import { buildScaleActionsFromPatterns, type ScaleAction } from "./scaleDecision";
import {
  assertScaleCooldown,
  dedupeAndCapScaleActions,
  filterAllowedScaleActions,
  gateScaleActionsWithPolicy,
  type PolicyGatedScaleAction,
} from "./scalePolicy";

/** Legacy alias — decision threshold lives in {@link scaleDecision}. */
export const SCALE_HIGH_CONFIDENCE = 0.75;

/** Auto-apply (design only) requires higher proof. */
export const SCALE_AUTO_DESIGN_THRESHOLD = 0.85;

export const SCALE_MAX_CHANGES = 2;

export type ScaleEngineMode = "suggest" | "auto" | "assisted";

export type ControlledScaleInput = {
  mode: ScaleEngineMode;
  intelligence: SystemIntelligence;
  /** Extra analytics stream for cooldown (recommended: {@link getEvents} analytics slice). */
  cooldownEvents?: readonly IntelligenceEvent[];
  negativeImpactObserved?: boolean;
  company_id?: string | null;
  page_id?: string | null;
  source_rid?: string | null;
};

export type ControlledScaleResult = {
  patternDetection: PatternDetectionOutput;
  /** Raw actions before dedupe (for UI transparency). */
  proposedActions: ScaleAction[];
  /** After dedupe, cap, policy, cooldown. */
  selectedActions: ScaleAction[];
  gated: PolicyGatedScaleAction[];
  cooldown: { ok: boolean; reason: string };
  /** Auto mode only: merged safe design patch (spacing from proven patterns). */
  autoSafeDesignPatches: DesignSettingsDocument[];
  logRid: string;
  explain: string[];
};

/** Back-compat shape for Control Tower / eldre klienter. */
export type ScaleProposalLegacy = {
  id: string;
  controlTowerMessage: string;
};

/** @deprecated Bruk {@link ControlledScaleResult}. */
export type ScaleEngineResult = ControlledScaleResult & {
  patterns: import("./patterns").DetectedWinningPatterns;
  proposals: ScaleProposalLegacy[];
  selectedForRollout: ScaleProposalLegacy[];
};

export function shouldRollbackScale(
  baseline: number,
  current: number,
  thresholdRelativeDrop = 0.12,
): { rollback: boolean; explain: string } {
  if (!Number.isFinite(baseline) || !Number.isFinite(current) || baseline <= 0) {
    return { rollback: false, explain: "Ugyldig baseline/current — ingen automatisk rollback-vurdering." };
  }
  const drop = (baseline - current) / baseline;
  if (drop >= thresholdRelativeDrop) {
    return {
      rollback: true,
      explain: `KPI falt ~${(drop * 100).toFixed(1)} % vs baseline — stopp auto-skala og vurder revert.`,
    };
  }
  return { rollback: false, explain: "KPI innenfor toleranse." };
}

export function scaleEngineToControlTowerMetadata(result: ControlledScaleResult): Record<string, unknown> {
  return {
    tool: "company_control_tower",
    phase: "scaling_opportunities",
    scaleLogRid: result.logRid,
    patterns: result.patternDetection.patterns,
    suggestions: result.selectedActions.map((a) => ({
      id: a.id,
      type: a.type,
      target: a.target,
      value: a.value,
      confidence: a.confidence,
      expectedImpact: a.expectedImpact,
    })),
    cooldown: result.cooldown,
    autoSafeDesignPatches: result.autoSafeDesignPatches,
  };
}

/**
 * Main entry: detect → decide → policy + cooldown → optional auto design patch list.
 */
export async function runControlledScaleEngine(input: ControlledScaleInput): Promise<ControlledScaleResult> {
  const logRid = input.source_rid ?? `scale_${Date.now().toString(36)}`;
  const patternDetection = detectPatternsFromSystemIntelligence(input.intelligence);

  if (!isScaleAutomationEnabled()) {
    opsLog("stabilization.scale_engine_disabled", { logRid, mode: input.mode });
    const cooldownSrc = input.cooldownEvents ?? input.intelligence.recentEvents;
    return {
      patternDetection,
      proposedActions: [],
      selectedActions: [],
      gated: [],
      cooldown: assertScaleCooldown(cooldownSrc),
      autoSafeDesignPatches: [],
      logRid,
      explain: ["Scale automation disabled (ENABLE_SCALE)."],
    };
  }

  const explain: string[] = [];
  const rawActions = buildScaleActionsFromPatterns(patternDetection.patterns);

  const cooldownSrc = input.cooldownEvents ?? input.intelligence.recentEvents;
  const cooldown = assertScaleCooldown(cooldownSrc);
  if (!cooldown.ok) {
    explain.push(`Cooldown: ${cooldown.reason}`);
  }

  const negative = input.negativeImpactObserved === true;
  if (negative) {
    explain.push("Negativ KPI/observe — auto-skala avslått.");
  }

  let working = rawActions;
  if (!cooldown.ok) {
    working = [];
  }

  const deduped = dedupeAndCapScaleActions(working, SCALE_MAX_CHANGES);
  const gated = gateScaleActionsWithPolicy(deduped);
  const allowed = filterAllowedScaleActions(gated);

  explain.push(
    `Mønstre=${patternDetection.patterns.length}; rå handlinger=${rawActions.length}; etter cap/policy=${allowed.length}.`,
  );

  let autoSafeDesignPatches: DesignSettingsDocument[] = [];
  if (input.mode === "auto" && !negative && cooldown.ok) {
    /* assisted/suggest never auto-merge design her — kun eksplisitt «Bruk» i tower. */
    const highProof = allowed.filter((a) => a.type === "design" && a.confidence >= SCALE_AUTO_DESIGN_THRESHOLD);
    const patch = buildDesignPatchFromScaleActions(highProof);
    if (patch && Object.keys(patch).length > 0) {
      autoSafeDesignPatches = [patch];
      explain.push("Auto: kun design-patch med tillit ≥ 0,85 (lav risiko).");
    }
  }

  const scaleLog = await logEvent({
    type: "analytics",
    source: "controlled_scale_engine",
    payload: {
      kind: "pattern_scale",
      phase: "plan",
      mode: input.mode,
      logRid,
      patterns: patternDetection.patterns,
      proposedActionIds: rawActions.map((a) => a.id),
      selectedActionIds: allowed.map((a) => a.id),
      cooldown,
      autoSafePatchCount: autoSafeDesignPatches.length,
      negativeImpactObserved: negative,
    },
    company_id: input.company_id,
    page_id: input.page_id,
    source_rid: logRid,
  });
  if (scaleLog.ok === false) {
    opsLog("ai_intelligence.controlled_scale_log_failed", { error: scaleLog.error });
  }

  try {
    await recordLearningOutcome({
      change: `controlled_scale:${input.mode}:${allowed.map((a) => a.id).join("|") || "none"}`,
      result: negative ? "blocked_negative_signal" : cooldown.ok ? "planned" : "blocked_cooldown",
      explain: explain.join(" · "),
      source: "controlled_scale_engine",
      company_id: input.company_id,
      page_id: input.page_id,
      source_rid: logRid,
    });
  } catch {
    /* best-effort */
  }

  return {
    patternDetection,
    proposedActions: rawActions,
    selectedActions: allowed,
    gated,
    cooldown,
    autoSafeDesignPatches,
    logRid,
    explain,
  };
}

/** @deprecated Prefer {@link runControlledScaleEngine} + {@link getSystemIntelligence}. */
export type ScaleEngineInput = {
  mode: ScaleEngineMode;
  events: readonly IntelligenceEvent[];
  negativeImpactObserved?: boolean;
  company_id?: string | null;
  page_id?: string | null;
  source_rid?: string | null;
};

/**
 * @deprecated Builds SI from events only — use {@link runControlledScaleEngine} for full fidelity.
 */
export async function runScaleEngine(input: ScaleEngineInput): Promise<ScaleEngineResult> {
  const { deriveTrendsFromEvents } = await import("./trends");
  const { extractLearningHistory } = await import("./learning");
  const { loadPatternWeights } = await import("@/lib/ai/learning");
  const { rebuildGtmLearningFromOutcomePayloads } = await import("@/lib/gtm/learning");

  const signals = await (await import("./signals")).deriveSystemSignalsFromEvents(input.events);
  const trends = deriveTrendsFromEvents(input.events, signals);
  const chrono = [...input.events].sort((a, b) => a.timestamp - b.timestamp);
  const gtmPayloads = chrono
    .filter((e) => e.type === "gtm" && (e.payload.kind === "gtm_outcome" || e.payload.kind == null))
    .map((e) => e.payload);
  const gtmLearning = rebuildGtmLearningFromOutcomePayloads(gtmPayloads);
  const eventCounts: Record<string, number> = {};
  for (const e of input.events) {
    const t = e.type || "unknown";
    eventCounts[t] = (eventCounts[t] ?? 0) + 1;
  }
  const weights = await loadPatternWeights();
  const topPatterns = Object.entries(weights)
    .map(([key, weight]) => ({ key, weight: Number(weight) || 0 }))
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 16);

  const intelligence: SystemIntelligence = {
    generatedAt: new Date().toISOString(),
    signals,
    recentEvents: input.events.slice(0, 250),
    trends,
    learningHistory: extractLearningHistory(input.events, 40),
    meta: { eventCounts, topPatterns, gtmLearning },
  };

  const r = await runControlledScaleEngine({
    mode: input.mode,
    intelligence,
    cooldownEvents: input.events,
    negativeImpactObserved: input.negativeImpactObserved,
    company_id: input.company_id,
    page_id: input.page_id,
    source_rid: input.source_rid,
  });

  const { detectWinningPatternsFromEvents } = await import("./patterns");
  const legacyPatterns = await detectWinningPatternsFromEvents(input.events);

  const toLegacy = (a: ScaleAction): ScaleProposalLegacy => ({
    id: a.id,
    controlTowerMessage: `${a.expectedImpact} — ${a.type}:${a.target}=${a.value} (tillit ${(a.confidence * 100).toFixed(0)} %)`,
  });

  return {
    ...r,
    patterns: legacyPatterns,
    proposals: r.proposedActions.map(toLegacy),
    selectedForRollout: r.selectedActions.map(toLegacy),
  };
}
