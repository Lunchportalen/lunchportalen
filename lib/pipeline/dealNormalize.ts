import { getStageById, type PipelineStageId, defaultStageFromStatus, isPipelineStageId } from "@/lib/pipeline/stages";

export type PipelineDealCard = {
  id: string;
  company_name: string;
  value: number;
  probability: number;
  created_at: string;
  stage: PipelineStageId;
  recent_activity: boolean;
  age_days: number;
  /** Når cron/engine har skrevet meta.predicted_* — brukes i UI i stedet for heuristikk. */
  predictionFromEngine?: {
    winProbability: number;
    risk: "low" | "medium" | "high";
    reasons: string[];
  };
};

function readMeta(row: Record<string, unknown>): Record<string, unknown> {
  const m = row.meta;
  if (m && typeof m === "object" && !Array.isArray(m)) return m as Record<string, unknown>;
  return {};
}

function toFiniteNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function resolvePipelineStage(row: Record<string, unknown>): PipelineStageId {
  const meta = readMeta(row);
  const raw = meta.pipeline_stage;
  if (typeof raw === "string" && isPipelineStageId(raw)) return raw;
  const status = typeof row.status === "string" ? row.status : "new";
  return defaultStageFromStatus(status);
}

export function resolveProbabilityForStage(stage: PipelineStageId, meta: Record<string, unknown>): number {
  const mp = meta.probability;
  if (mp !== undefined && mp !== null) {
    const p = toFiniteNumber(mp);
    if (p > 1 && p <= 100) return p / 100;
    if (p >= 0 && p <= 1) return p;
  }
  return getStageById(stage)?.probability ?? 0;
}

export function normalizeLeadPipelineRow(row: Record<string, unknown>): PipelineDealCard | null {
  const id = typeof row.id === "string" ? row.id : null;
  if (!id) return null;

  const meta = readMeta(row);
  const stage = resolvePipelineStage(row);
  const value = toFiniteNumber(row.value_estimate);
  const probability = resolveProbabilityForStage(stage, meta);

  const createdRaw = row.created_at;
  const created_at =
    typeof createdRaw === "string" ? createdRaw : createdRaw != null ? String(createdRaw) : new Date(0).toISOString();

  const created = new Date(created_at);
  const age_ms = Date.now() - created.getTime();
  const age_days = Number.isFinite(age_ms) ? age_ms / 86_400_000 : 999;

  const company =
    typeof meta.company_name === "string" && meta.company_name.trim()
      ? meta.company_name.trim()
      : typeof row.source_post_id === "string"
        ? row.source_post_id
        : "Uten navn";

  const recentRaw = meta.recent_activity_at;
  let recent_activity = false;
  if (typeof recentRaw === "string" && recentRaw.length > 0) {
    const t = new Date(recentRaw).getTime();
    if (Number.isFinite(t)) recent_activity = true;
  }

  let predictionFromEngine: PipelineDealCard["predictionFromEngine"];
  const pp = meta.predicted_probability;
  const pr = meta.predicted_risk;
  const prs = meta.prediction_reasons;
  if (typeof pp === "number" && Number.isFinite(pp) && pp >= 0 && pp <= 100) {
    const risk =
      pr === "low" || pr === "medium" || pr === "high" ? pr : ("medium" as const);
    const reasons = Array.isArray(prs) ? prs.filter((x): x is string => typeof x === "string") : [];
    predictionFromEngine = {
      winProbability: Math.round(pp),
      risk,
      reasons,
    };
  }

  return {
    id,
    company_name: company,
    value,
    probability,
    created_at,
    stage,
    recent_activity,
    age_days,
    ...(predictionFromEngine ? { predictionFromEngine } : {}),
  };
}
