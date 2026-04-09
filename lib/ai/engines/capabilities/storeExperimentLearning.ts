/**
 * Experiment learning memory capability: storeExperimentLearning.
 * Builds ai_experiment_memory records from scoring/detection results so historical
 * outcomes can be stored and queried later. Does not perform DB insert; output is
 * consumed by caller (e.g. experimentMemory.insertExperimentMemoryBatch).
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";
import type { AiExperimentMemoryInsert, ExperimentMemoryOutcome, ExperimentMemoryPrimaryMetric } from "../../experiments/experimentMemory";

const CAPABILITY_NAME = "storeExperimentLearning";

const storeExperimentLearningCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Experiment learning memory: builds ai_experiment_memory records from experiment results and detection/score output. Returns array of records to insert (experiment_id, variant, outcome winner|runner_up|other, views, clicks, conversions, primary_metric). Caller persists via experimentMemory.insertExperimentMemoryBatch. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Store experiment learning input",
    properties: {
      experimentId: { type: "string", description: "Experiment identifier" },
      variants: {
        type: "array",
        description: "Per-variant stats: variant, views, clicks, conversions",
        items: {
          type: "object",
          required: ["variant", "views", "clicks", "conversions"],
          properties: {
            variant: { type: "string" },
            views: { type: "number" },
            clicks: { type: "number" },
            conversions: { type: "number" },
          },
        },
      },
      detectionResult: {
        type: "object",
        description: "Output from detectWinningVariant (hasWinner, winningVariant, runnerUp)",
        properties: {
          hasWinner: { type: "boolean" },
          winningVariant: { type: "string" },
          runnerUp: { type: "string" },
          evidence: { type: "object", properties: { primaryMetric: { type: "string" } } },
        },
      },
      scoreResult: {
        type: "object",
        description: "Output from scoreExperimentResults (variantScores with rank, recommendation.winner)",
        properties: {
          variantScores: {
            type: "array",
            items: {
              type: "object",
              properties: {
                variant: { type: "string" },
                views: { type: "number" },
                clicks: { type: "number" },
                conversions: { type: "number" },
                rank: { type: "number" },
              },
            },
          },
          recommendation: { type: "object", properties: { winner: { type: "string" }, status: { type: "string" } } },
          primaryMetric: { type: "string" },
        },
      },
      primaryMetric: { type: "string", description: "conversions | clicks | views (default from detection/score or conversions)" },
      pageId: { type: "string", description: "Optional page_id for stored records" },
      snapshotAt: { type: "string", description: "Optional ISO timestamp for snapshot_at" },
    },
    required: ["experimentId", "variants"],
  },
  outputSchema: {
    type: "object",
    description: "Records ready for ai_experiment_memory insert",
    required: ["records", "storedAt"],
    properties: {
      records: {
        type: "array",
        items: {
          type: "object",
          required: ["experiment_id", "variant", "outcome", "views", "clicks", "conversions", "primary_metric"],
          properties: {
            experiment_id: { type: "string" },
            page_id: { type: "string" },
            variant: { type: "string" },
            outcome: { type: "string", enum: ["winner", "runner_up", "other"] },
            views: { type: "number" },
            clicks: { type: "number" },
            conversions: { type: "number" },
            primary_metric: { type: "string" },
            snapshot_at: { type: "string" },
            metadata: { type: "object" },
          },
        },
      },
      storedAt: { type: "string", description: "ISO timestamp used for snapshot_at" },
    },
  },
  safetyConstraints: [
    {
      code: "output_only",
      description: "Output is records only; actual insert must be performed by caller (e.g. experimentMemory.insertExperimentMemoryBatch).",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(storeExperimentLearningCapability);

export type VariantInput = {
  variant: string;
  views: number;
  clicks: number;
  conversions: number;
};

export type DetectionResultLike = {
  hasWinner?: boolean;
  winningVariant?: string;
  runnerUp?: string;
  evidence?: { primaryMetric?: string };
};

export type ScoreResultLike = {
  variantScores?: Array<{ variant: string; views: number; clicks: number; conversions: number; rank?: number }>;
  recommendation?: { winner?: string; status?: string };
  primaryMetric?: string;
};

export type StoreExperimentLearningInput = {
  experimentId: string;
  variants: VariantInput[];
  detectionResult?: DetectionResultLike | null;
  scoreResult?: ScoreResultLike | null;
  primaryMetric?: ExperimentMemoryPrimaryMetric | null;
  pageId?: string | null;
  snapshotAt?: string | null;
};

export type StoreExperimentLearningOutput = {
  records: AiExperimentMemoryInsert[];
  storedAt: string;
};

function toPrimaryMetric(s: string | undefined): ExperimentMemoryPrimaryMetric {
  if (s === "clicks" || s === "views") return s;
  return "conversions";
}

/**
 * Builds ai_experiment_memory records from experiment variants and detection/score result.
 * Deterministic; no external calls. Caller persists via insertExperimentMemoryBatch.
 */
export function storeExperimentLearning(input: StoreExperimentLearningInput): StoreExperimentLearningOutput {
  const experimentId = String(input.experimentId ?? "").trim();
  const variants = Array.isArray(input.variants) ? input.variants : [];
  const snapshotAt = input.snapshotAt ?? new Date().toISOString();
  const pageId = input.pageId ?? null;
  const detection = input.detectionResult;
  const score = input.scoreResult;

  let primaryMetric: ExperimentMemoryPrimaryMetric = toPrimaryMetric(input.primaryMetric);
  if (detection?.evidence?.primaryMetric) primaryMetric = toPrimaryMetric(detection.evidence.primaryMetric);
  else if (score?.primaryMetric) primaryMetric = toPrimaryMetric(score.primaryMetric);

  let winner = "";
  let runnerUp = "";
  if (detection?.hasWinner && detection.winningVariant) {
    winner = String(detection.winningVariant).trim();
    runnerUp = String(detection.runnerUp ?? "").trim();
  } else if (score?.recommendation?.status === "winner" && score.recommendation.winner) {
    winner = String(score.recommendation.winner).trim();
    const ranks = score.variantScores ?? [];
    const second = ranks.find((v) => v.variant !== winner && v.rank === 2) ?? ranks.find((v) => v.variant !== winner);
    runnerUp = second ? String(second.variant).trim() : "";
  }

  const variantMap = new Map<string | undefined, { views: number; clicks: number; conversions: number }>();
  for (const v of variants) {
    const key = String(v?.variant ?? "").trim() || undefined;
    variantMap.set(key, {
      views: Math.max(0, Number(v?.views) ?? 0),
      clicks: Math.max(0, Number(v?.clicks) ?? 0),
      conversions: Math.max(0, Number(v?.conversions) ?? 0),
    });
  }
  if (score?.variantScores) {
    for (const vs of score.variantScores) {
      const key = String(vs.variant ?? "").trim() || undefined;
      if (!variantMap.has(key))
        variantMap.set(key, {
          views: Math.max(0, Number(vs.views) ?? 0),
          clicks: Math.max(0, Number(vs.clicks) ?? 0),
          conversions: Math.max(0, Number(vs.conversions) ?? 0),
        });
    }
  }

  const records: AiExperimentMemoryInsert[] = [];
  const seen = new Set<string>();
  const variantKeys = Array.from(variantMap.keys()).filter(Boolean) as string[];
  if (variantKeys.length === 0 && winner) variantKeys.push(winner);
  if (runnerUp && !variantKeys.includes(runnerUp)) variantKeys.push(runnerUp);

  for (const variant of variantKeys) {
    if (!variant || seen.has(variant)) continue;
    seen.add(variant);
    const stats = variantMap.get(variant) ?? { views: 0, clicks: 0, conversions: 0 };
    let outcome: ExperimentMemoryOutcome = "other";
    if (winner && variant === winner) outcome = "winner";
    else if (runnerUp && variant === runnerUp) outcome = "runner_up";

    records.push({
      experiment_id: experimentId,
      page_id: pageId ?? undefined,
      variant,
      outcome,
      views: stats.views,
      clicks: stats.clicks,
      conversions: stats.conversions,
      primary_metric: primaryMetric,
      snapshot_at: snapshotAt,
      metadata: {},
    });
  }

  return {
    records,
    storedAt: snapshotAt,
  };
}

export { storeExperimentLearningCapability, CAPABILITY_NAME };
