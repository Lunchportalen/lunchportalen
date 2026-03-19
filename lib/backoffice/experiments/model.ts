/**
 * CRO / Experiment foundation — editorial experiment model.
 * Status: draft | active | paused | completed. No hidden traffic split without explicit config.
 * Fail-closed: runtime experiment routing is not implemented here; when added, routing must
 * be guaranteed or disabled (no silent fallback). Normal page rendering is unchanged.
 */

export type ExperimentType = "headline" | "cta" | "hero_body";
export type ExperimentStatus = "draft" | "active" | "paused" | "completed";

export type ExperimentVariantConfig = {
  key: string;
  label: string;
  headline?: string;
  ctaTitle?: string;
  ctaBody?: string;
  ctaButtonLabel?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroCtaLabel?: string;
  /** Optional AIPatchV1 for applying variant to blocks (editor use). */
  patch?: unknown;
};

export type ExperimentConfig = {
  variants?: ExperimentVariantConfig[];
  /** Optional: traffic split weights (e.g. { A: 0.5, B: 0.5 }). Not used until runtime routing is enabled. */
  trafficSplit?: Record<string, number>;
};

export type ContentExperimentRow = {
  id: string;
  page_id: string;
  variant_id: string | null;
  name: string;
  type: ExperimentType;
  status: ExperimentStatus;
  experiment_id: string;
  config: ExperimentConfig;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type ContentExperimentInsert = {
  page_id: string;
  variant_id?: string | null;
  name: string;
  type: ExperimentType;
  status?: ExperimentStatus;
  experiment_id: string;
  config?: ExperimentConfig;
  created_by?: string | null;
};

export type ContentExperimentUpdate = {
  name?: string;
  type?: ExperimentType;
  status?: ExperimentStatus;
  config?: ExperimentConfig;
  updated_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
};

const EXPERIMENT_ID_REGEX = /^[a-zA-Z0-9_-]{1,80}$/;

export function isValidExperimentId(id: string): boolean {
  return EXPERIMENT_ID_REGEX.test(id);
}

export function newExperimentId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `exp_${crypto.randomUUID()}`;
  }
  return `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const ALLOWED_TYPES: ExperimentType[] = ["headline", "cta", "hero_body"];
const ALLOWED_STATUSES: ExperimentStatus[] = ["draft", "active", "paused", "completed"];

export function isExperimentType(v: unknown): v is ExperimentType {
  return typeof v === "string" && ALLOWED_TYPES.includes(v as ExperimentType);
}

export function isExperimentStatus(v: unknown): v is ExperimentStatus {
  return typeof v === "string" && ALLOWED_STATUSES.includes(v as ExperimentStatus);
}
