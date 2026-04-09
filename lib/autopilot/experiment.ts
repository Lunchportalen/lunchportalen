/**
 * Minimal autopilot A/B experiment engine — additive, deterministic evaluation,
 * process-local safety (max one running experiment per target), full audit via
 * {@link logAutopilot}. Does not mutate CMS or live product data; outcomes are
 * computed values + logs only.
 */
import "server-only";

import { createHash } from "crypto";

import { storeResult } from "@/lib/autopilot/learning";
import { logAutopilot } from "@/lib/autopilot/log";

const ROUTE = "autopilot_experiment_engine";

/** Fixed weights — deterministic composite score (sum = 1). */
const W_REV = 0.5;
const W_CONV = 0.3;
const W_ENG = 0.2;
const EPS = 1e-9;
const DEFAULT_MAX_EVALUATIONS = 1000;

export type Experiment = {
  id: string;
  type: "price" | "copy" | "ui";
  target: string;
  variantA: any;
  variantB: any;
  status: "running" | "completed";
  startedAt: number;
  result?: {
    winner: "A" | "B";
    confidence: number;
    impact: number;
  };
  /** Additive: evaluations performed (for auto-stop). */
  evaluationCount?: number;
  /** Additive: auto-complete after this many evaluateExperiment calls (default {@link DEFAULT_MAX_EVALUATIONS}). */
  maxEvaluations?: number;
  /** Additive: correlation id for logs. */
  rid?: string;
};

export type StartExperimentConfig = {
  type: Experiment["type"];
  target: string;
  variantA: any;
  variantB: any;
  /** Correlation id for audit (recommended). */
  rid?: string;
  maxEvaluations?: number;
};

/** Per-variant metrics for one evaluation pass — no live writes; numbers only. */
export type ExperimentEvaluationMetrics = {
  revenueA: number;
  revenueB: number;
  conversionsA: number;
  conversionsB: number;
  engagementA: number;
  engagementB: number;
};

/** Process-local registry (single Node isolate). Not shared across serverless instances. */
const experimentsById = new Map<string, Experiment>();
const activeTargetToExperimentId = new Map<string, string>();

let idSeq = 0;

function makeRid(): string {
  idSeq += 1;
  return `apx_${Date.now().toString(36)}_${idSeq.toString(36)}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableStringify(o[k])).join(",")}}`;
}

function experimentId(config: StartExperimentConfig, startedAt: number, seq: number): string {
  const h = createHash("sha256")
    .update(
      `${config.type}|${config.target}|${startedAt}|${seq}|${stableStringify(config.variantA)}|${stableStringify(config.variantB)}|${config.rid ?? ""}`,
    )
    .digest("hex");
  return `exp_${h.slice(0, 24)}`;
}

function cloneVariant<T>(v: T): T {
  try {
    if (typeof structuredClone === "function") {
      return structuredClone(v);
    }
  } catch {
    /* fall through */
  }
  try {
    return JSON.parse(JSON.stringify(v)) as T;
  } catch {
    return v;
  }
}

function normalizeScore(rev: number, conv: number, eng: number, maxRev: number, maxConv: number, maxEng: number): number {
  const r = Math.max(rev, 0) / (maxRev + EPS);
  const c = Math.max(conv, 0) / (maxConv + EPS);
  const e = Math.max(eng, 0) / (maxEng + EPS);
  return W_REV * r + W_CONV * c + W_ENG * e;
}

/**
 * Deterministic winner + confidence + impact from a single metrics snapshot.
 * Tie-breaker: A wins when scores are equal.
 */
export function computeDeterministicOutcome(
  metrics: ExperimentEvaluationMetrics,
): NonNullable<Experiment["result"]> {
  const maxRev = Math.max(metrics.revenueA, metrics.revenueB, EPS);
  const maxConv = Math.max(metrics.conversionsA, metrics.conversionsB, EPS);
  const maxEng = Math.max(metrics.engagementA, metrics.engagementB, EPS);

  const sA = normalizeScore(metrics.revenueA, metrics.conversionsA, metrics.engagementA, maxRev, maxConv, maxEng);
  const sB = normalizeScore(metrics.revenueB, metrics.conversionsB, metrics.engagementB, maxRev, maxConv, maxEng);

  const winner: "A" | "B" = sA >= sB ? "A" : "B";
  const loser: "A" | "B" = winner === "A" ? "B" : "A";

  const confidence = Math.min(1, Math.max(0, Math.abs(sA - sB)));

  const revW = winner === "A" ? metrics.revenueA : metrics.revenueB;
  const revL = loser === "A" ? metrics.revenueA : metrics.revenueB;
  const impact = (revW - revL) / (revL + EPS);

  return { winner, confidence, impact };
}

/**
 * Starts an experiment: clones variants (no shared references), enforces max one
 * running experiment per target, logs start. Does not write to CMS or DB beyond logs.
 */
export function startExperiment(config: StartExperimentConfig): Experiment {
  const rid = config.rid ?? makeRid();
  const startedAt = Date.now();
  const targetKey = `${config.type}:${config.target.trim()}`;

  if (activeTargetToExperimentId.has(targetKey)) {
    const existingId = activeTargetToExperimentId.get(targetKey)!;
    void logAutopilot({
      kind: "experiment_start_denied",
      rid,
      payload: {
        reason: "max_one_active_per_target",
        targetKey,
        existingExperimentId: existingId,
        deterministic: true,
        reversible: true,
      },
    });
    throw new Error(`AUTOPILOT_EXPERIMENT_TARGET_ACTIVE:${targetKey}`);
  }

  idSeq += 1;
  const id = experimentId(config, startedAt, idSeq);
  const maxEvaluations = Math.max(1, Math.floor(config.maxEvaluations ?? DEFAULT_MAX_EVALUATIONS));

  const exp: Experiment = {
    id,
    type: config.type,
    target: config.target.trim(),
    variantA: cloneVariant(config.variantA),
    variantB: cloneVariant(config.variantB),
    status: "running",
    startedAt,
    evaluationCount: 0,
    maxEvaluations,
    rid,
  };

  experimentsById.set(id, exp);
  activeTargetToExperimentId.set(targetKey, id);

  void logAutopilot({
    kind: "experiment_started",
    rid,
    payload: {
      experimentId: id,
      type: exp.type,
      target: exp.target,
      targetKey,
      maxEvaluations,
      variantA: exp.variantA,
      variantB: exp.variantB,
      startedAt,
      deterministic: true,
      reversible: true,
      note: "No live data mutation — engine state is in-memory + logs only.",
    },
  });

  return exp;
}

/**
 * Evaluates one metrics snapshot. Deterministic outcome per metrics.
 * Auto-completes when evaluationCount reaches maxEvaluations (removes active target lock).
 * Never writes metrics to production stores — caller supplies numbers only.
 */
export function evaluateExperiment(exp: Experiment, metrics: ExperimentEvaluationMetrics): Experiment {
  const rid = exp.rid ?? makeRid();
  const live = experimentsById.get(exp.id) ?? exp;

  if (live.status === "completed") {
    void logAutopilot({
      kind: "experiment_evaluate_skipped",
      rid,
      payload: { experimentId: live.id, reason: "already_completed", deterministic: true },
    });
    return live;
  }

  const targetKey = `${live.type}:${live.target}`;
  const activeId = activeTargetToExperimentId.get(targetKey);
  if (activeId !== undefined && activeId !== live.id) {
    void logAutopilot({
      kind: "experiment_evaluate_denied",
      rid,
      payload: { experimentId: live.id, targetKey, activeId, reason: "target_mismatch", deterministic: true },
    });
    throw new Error(`AUTOPILOT_EXPERIMENT_MISMATCH:${live.id}`);
  }

  const maxEval = Math.max(1, Math.floor(live.maxEvaluations ?? DEFAULT_MAX_EVALUATIONS));
  const prevCount = Math.max(0, Math.floor(live.evaluationCount ?? 0));
  const nextCount = prevCount + 1;

  const outcome = computeDeterministicOutcome(metrics);

  void logAutopilot({
    kind: "experiment_evaluated",
    rid,
    payload: {
      experimentId: live.id,
      evaluationIndex: nextCount,
      maxEvaluations: maxEval,
      metrics,
      computedOutcome: outcome,
      deterministic: true,
      reversible: true,
    },
  });

  const base: Experiment = {
    ...live,
    evaluationCount: nextCount,
  };

  if (nextCount >= maxEval) {
    activeTargetToExperimentId.delete(targetKey);

    const completed: Experiment = {
      ...base,
      status: "completed",
      result: outcome,
    };
    experimentsById.set(live.id, completed);

    void logAutopilot({
      kind: "experiment_completed",
      rid,
      payload: {
        experimentId: live.id,
        targetKey,
        result: outcome,
        evaluationCount: nextCount,
        autoStop: true,
        deterministic: true,
        reversible: true,
      },
    });

    storeResult(
      {
        id: completed.id,
        type: completed.type,
        target: completed.target,
        variantA: completed.variantA,
        variantB: completed.variantB,
      },
      outcome,
    );

    return completed;
  }

  experimentsById.set(live.id, base);
  return base;
}

/**
 * Reversible: marks a completed experiment as running again and clears result
 * (in-memory only). Logs reversal. Does not restore prior CMS state.
 */
export function reopenExperiment(exp: Experiment): Experiment {
  const rid = exp.rid ?? makeRid();
  if (exp.status !== "completed") {
    void logAutopilot({
      kind: "experiment_reopen_skipped",
      rid,
      payload: { experimentId: exp.id, reason: "not_completed" },
    });
    return exp;
  }

  const targetKey = `${exp.type}:${exp.target}`;
  if (activeTargetToExperimentId.has(targetKey)) {
    void logAutopilot({
      kind: "experiment_reopen_denied",
      rid,
      payload: { experimentId: exp.id, reason: "target_has_active", targetKey },
    });
    throw new Error(`AUTOPILOT_EXPERIMENT_TARGET_ACTIVE:${targetKey}`);
  }

  const reopened: Experiment = {
    ...exp,
    status: "running",
    result: undefined,
    evaluationCount: 0,
  };

  activeTargetToExperimentId.set(targetKey, exp.id);
  experimentsById.set(exp.id, reopened);

  void logAutopilot({
    kind: "experiment_reopened",
    rid,
    payload: {
      experimentId: exp.id,
      targetKey,
      previousResult: exp.result,
      deterministic: true,
      reversible: true,
    },
  });

  return reopened;
}

/** Read-only snapshot from in-memory registry (diagnostics). */
export function getExperimentById(id: string): Experiment | undefined {
  return experimentsById.get(id);
}

/** True if any experiment is still `running` (global guard for autopilot loop). */
export function hasAnyRunningExperiment(): boolean {
  for (const e of experimentsById.values()) {
    if (e.status === "running") return true;
  }
  return false;
}

/** In-memory diagnostics — empty on cold start / other isolates. */
export function getRunningExperimentsSnapshot(): Experiment[] {
  return Array.from(experimentsById.values()).filter((e) => e.status === "running");
}
