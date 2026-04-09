import "server-only";

import { executeCeoActions } from "@/lib/ai/ceoExecutor";
import { rankVariants, rankVariantsAsync } from "@/lib/ai/pre-evaluate";
import type { VariantPredictInput } from "@/lib/ai/predictor";
import { aiCeoDecision } from "@/lib/ai/strategicCeoDecision";
import { collectAutopilotMetrics } from "@/lib/autopilot/collectMetrics";
import {
  hasAnyRunningExperiment,
  startExperiment,
  type Experiment,
  type StartExperimentConfig,
} from "@/lib/autopilot/experiment";
import { generateExperimentProposal, saveExperimentProposal } from "@/lib/autopilot/experimentProposal";
import { isAutopilotEnabled } from "@/lib/autopilot/kill-switch";
import { logAutopilot } from "@/lib/autopilot/log";
import { detectOpportunities, detectOpportunity } from "@/lib/autopilot/opportunities";
import type { AutopilotOpportunity } from "@/lib/autopilot/types";
import { getSequenceEventsForAutopilot } from "@/lib/autopilot/sequenceEvents";
import { buildUserSequences } from "@/lib/ml/sequence-dataset";
import { updateState } from "@/lib/ml/sequence-model";
import { chooseAction } from "@/lib/rl/engine";

export type AutopilotIntelligence = {
  ceoDecisions: ReturnType<typeof aiCeoDecision>;
  rankedVariants: ReturnType<typeof rankVariants<VariantPredictInput>>;
};

export type AutopilotPhase3 = {
  rlAction: string | null;
  sequencesProcessed: number;
};

export type AutopilotPhase4 = {
  /** When true, ranking used async ONNX path when enabled; otherwise logistic. */
  onnxRanking: boolean;
};

export type AutopilotCycleResult =
  | { status: "disabled" }
  | { status: "idle"; reason: string; phase3?: AutopilotPhase3 }
  | {
      status: "experiment_created";
      experimentId: string;
      hypothesis: string;
      intelligence?: AutopilotIntelligence;
      phase3?: AutopilotPhase3;
      phase4?: AutopilotPhase4;
    }
  | { status: "error"; message: string };

/** Result of the controlled {@link runAutopilot} loop (no auto-deploy; logs only). */
export type AutopilotLoopResult =
  | { status: "disabled" }
  | { status: "skipped"; reason: "rate_limit_1h" | "active_experiment" }
  | { status: "idle"; reason: "no_opportunity" }
  | { status: "created"; experiment: Experiment }
  | { status: "error"; message: string };

const AUTOPILOT_EXPERIMENT_TARGET = "autopilot_singleton";

/** Max one loop invocation per hour (process-local clock). */
const AUTOPILOT_LOOP_MIN_INTERVAL_MS = 60 * 60 * 1000;

let autopilotLoopLastRunMs = 0;

function makeLoopRid(): string {
  return `ap_loop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

let lastAutopilotLoopRun: { at: number; result: AutopilotLoopResult } | null = null;

function finishAutopilotLoop(result: AutopilotLoopResult): AutopilotLoopResult {
  lastAutopilotLoopRun = { at: Date.now(), result };
  return result;
}

/** Last completed {@link runAutopilot} outcome in this Node isolate (null if never run). */
export function getLastAutopilotLoopRun(): { at: number; result: AutopilotLoopResult } | null {
  return lastAutopilotLoopRun;
}

/**
 * Maps a ranked opportunity to deterministic A/B payloads (audit-only; not applied to live catalog).
 * low_conversion → copy · low_revenue → price · high_bounce → UI · thin_traffic → copy
 */
export function opportunityToStartConfig(opportunity: AutopilotOpportunity, rid: string): StartExperimentConfig {
  const t = opportunity.type;
  switch (t) {
    case "low_conversion":
      return {
        type: "copy",
        target: AUTOPILOT_EXPERIMENT_TARGET,
        variantA: { mode: "baseline_copy", cta: "Les mer" },
        variantB: { mode: "challenger_copy", cta: "Kom i gang nå" },
        rid,
      };
    case "low_revenue":
      return {
        type: "price",
        target: AUTOPILOT_EXPERIMENT_TARGET,
        variantA: { priceMultiplier: 1 },
        variantB: { priceMultiplier: 1.03 },
        rid,
      };
    case "high_bounce":
      return {
        type: "ui",
        target: AUTOPILOT_EXPERIMENT_TARGET,
        variantA: { layout: "default_density" },
        variantB: { layout: "scannable_blocks" },
        rid,
      };
    case "thin_traffic":
      return {
        type: "copy",
        target: AUTOPILOT_EXPERIMENT_TARGET,
        variantA: { hook: "awareness" },
        variantB: { hook: "distribution" },
        rid,
      };
    default: {
      const _x: never = t;
      return _x;
    }
  }
}

/**
 * Minimal controlled loop: metrics → single opportunity → in-memory experiment (logged).
 * - Respects kill-switch.
 * - At most **one invocation per hour** (process-local).
 * - Refuses to start if **any** experiment is already `running` (global in-memory guard).
 * - Never deploys or mutates live CMS/prices — engine state + `logAutopilot` only.
 */
export async function runAutopilot(opts?: { rid?: string }): Promise<AutopilotLoopResult> {
  const rid = opts?.rid ?? makeLoopRid();
  const now = Date.now();

  if (!isAutopilotEnabled()) {
    await logAutopilot({ kind: "autopilot_loop_skipped", rid, payload: { reason: "kill_switch" } });
    return finishAutopilotLoop({ status: "disabled" });
  }

  if (now - autopilotLoopLastRunMs < AUTOPILOT_LOOP_MIN_INTERVAL_MS) {
    await logAutopilot({
      kind: "autopilot_loop_skipped",
      rid,
      payload: {
        reason: "rate_limit_1h",
        nextEligibleAt: autopilotLoopLastRunMs + AUTOPILOT_LOOP_MIN_INTERVAL_MS,
      },
    });
    return finishAutopilotLoop({ status: "skipped", reason: "rate_limit_1h" });
  }

  const m = await collectAutopilotMetrics();
  if (m.ok === false) {
    await logAutopilot({ kind: "autopilot_loop_metrics_failed", rid, payload: { error: m.error } });
    autopilotLoopLastRunMs = Date.now();
    return finishAutopilotLoop({ status: "error", message: m.error });
  }

  const { metrics } = m;
  await logAutopilot({ kind: "autopilot_loop_metrics", rid, payload: { metrics } });

  const opportunity = detectOpportunity(metrics);
  if (!opportunity) {
    await logAutopilot({ kind: "autopilot_loop_idle", rid, payload: { reason: "no_opportunity" } });
    autopilotLoopLastRunMs = Date.now();
    return finishAutopilotLoop({ status: "idle", reason: "no_opportunity" });
  }

  if (hasAnyRunningExperiment()) {
    await logAutopilot({ kind: "autopilot_loop_skipped", rid, payload: { reason: "active_experiment" } });
    autopilotLoopLastRunMs = Date.now();
    return finishAutopilotLoop({ status: "skipped", reason: "active_experiment" });
  }

  const config = opportunityToStartConfig(opportunity, rid);

  try {
    const experiment = startExperiment(config);
    await logAutopilot({
      kind: "autopilot_loop_experiment_started",
      rid,
      payload: {
        experimentId: experiment.id,
        opportunity,
        config,
        note: "Controlled start — no deploy; in-memory experiment + logs only.",
      },
    });
    autopilotLoopLastRunMs = Date.now();
    return finishAutopilotLoop({ status: "created", experiment });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logAutopilot({
      kind: "autopilot_loop_start_failed",
      rid,
      payload: { error: message, opportunity, config },
    });
    autopilotLoopLastRunMs = Date.now();
    return finishAutopilotLoop({ status: "error", message });
  }
}

/** Alias for prompt compatibility. */
export const collectMetrics = collectAutopilotMetrics;

function fullCycleEnabled(): boolean {
  return String(process.env.LP_AUTOPILOT_FULL_CYCLE ?? "").trim() === "true";
}

function phase3Enabled(): boolean {
  return String(process.env.LP_AUTOPILOT_PHASE3 ?? "").trim() === "true";
}

function phase4OnnxRankingEnabled(): boolean {
  return String(process.env.LP_AUTOPILOT_PHASE4 ?? "").trim() === "true";
}

function buildSyntheticVariants(opportunityType: string): VariantPredictInput[] {
  return [
    {
      title: `Baseline ${opportunityType}`,
      cta: "Les mer",
      hasImage: false,
      positionScore: 0.35,
    },
    {
      title: `Challenger ${opportunityType}`,
      cta: "Kom i gang",
      hasImage: true,
      positionScore: 0.72,
    },
  ];
}

async function runPhase3SequenceRl(rid: string): Promise<AutopilotPhase3> {
  const events = await getSequenceEventsForAutopilot(rid);
  const sequences = buildUserSequences(events);
  for (const bundle of sequences) {
    for (const step of bundle.steps) {
      updateState(bundle.userId, step.value);
    }
  }
  const rlAction = chooseAction(["improve_cta", "change_layout", "increase_price", "expand_content"]);
  const out: AutopilotPhase3 = {
    rlAction,
    sequencesProcessed: sequences.length,
  };
  await logAutopilot({ kind: "phase3_rl", rid, payload: out });
  return out;
}

/**
 * Full loop: metrics → (optional CEO+ML) → opportunities → **proposal** (logged) — never auto-publish CMS.
 * `LP_AUTOPILOT_FULL_CYCLE=true`: strategic CEO + ranked synthetic variants (audit only).
 * `LP_AUTOPILOT_PHASE3=true`: sequence state + RL action choice (audit only; events feed may be empty).
 * `LP_AUTOPILOT_PHASE4=true`: ONNX-backed async ranking when `LP_ONNX_ENABLED=true` + model present; else logistic.
 */
export async function runAutopilotCycle(opts: { rid: string }): Promise<AutopilotCycleResult> {
  const { rid } = opts;
  const full = fullCycleEnabled();
  const p3 = phase3Enabled();
  const p4 = phase4OnnxRankingEnabled();

  if (!isAutopilotEnabled()) {
    await logAutopilot({ kind: "cycle_skipped", rid, payload: { reason: "kill_switch" } });
    return { status: "disabled" };
  }

  const m = await collectAutopilotMetrics();
  if (m.ok === false) {
    await logAutopilot({ kind: "metrics_failed", rid, payload: { error: m.error } });
    return { status: "error", message: m.error };
  }

  const { metrics } = m;
  await logAutopilot({ kind: "metrics", rid, payload: { metrics } });

  let phase3: AutopilotPhase3 | undefined;
  if (p3) {
    phase3 = await runPhase3SequenceRl(rid);
  }

  const ceoMetrics = {
    revenue: metrics.revenue,
    previousRevenue: 0,
    sessions: metrics.sessions,
    previousSessions: 0,
  };

  if (full) {
    const ceoDecisions = aiCeoDecision({ metrics: ceoMetrics });
    await executeCeoActions(ceoDecisions, rid);
    await logAutopilot({
      kind: "ceo_phase",
      rid,
      payload: { ceoDecisions, note: "Historikk ikke koblet — previous* satt til 0 (deterministisk)." },
    });
  }

  const opportunities = detectOpportunities(metrics);
  if (!opportunities.length) {
    await logAutopilot({ kind: "idle", rid, payload: { reason: "no_opportunities" } });
    return { status: "idle", reason: "no_opportunities", ...(phase3 ? { phase3 } : {}) };
  }

  const top = opportunities[0]!;
  const experiment = generateExperimentProposal(top, rid);

  let intelligence: AutopilotIntelligence | undefined;
  let phase4: AutopilotPhase4 | undefined;
  if (full) {
    const ceoDecisions = aiCeoDecision({ metrics: ceoMetrics });
    const variants = buildSyntheticVariants(top.type);
    const rankedVariants = p4 ? await rankVariantsAsync(variants) : rankVariants(variants);
    phase4 = { onnxRanking: p4 };
    intelligence = { ceoDecisions, rankedVariants };
    await logAutopilot({
      kind: "ml_rank",
      rid,
      payload: {
        phase4: "LP_AUTOPILOT_PHASE4",
        onnxRanking: p4,
        ranked: rankedVariants.map((r) => ({
          title: r.title,
          predictedConversion: r.prediction.predictedConversion,
          explain: r.prediction.explain,
        })),
      },
    });
  }

  const saved = await saveExperimentProposal(experiment, rid);

  if (saved.ok === false) {
    await logAutopilot({ kind: "save_failed", rid, payload: { error: saved.error } });
    return { status: "error", message: saved.error };
  }

  await logAutopilot({
    kind: "experiment_proposal_saved",
    rid,
    payload: { experimentId: experiment.id, hypothesis: experiment.hypothesis },
  });

  return {
    status: "experiment_created",
    experimentId: experiment.id,
    hypothesis: experiment.hypothesis,
    ...(intelligence ? { intelligence } : {}),
    ...(phase3 ? { phase3 } : {}),
    ...(phase4 ? { phase4 } : {}),
  };
}
