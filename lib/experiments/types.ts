import "server-only";

export type ExperimentStatus = "draft" | "running" | "completed";

export type ExperimentEventType = "view" | "impression" | "click" | "conversion";

export type WeightedVariant = {
  variantId: string;
  weight: number;
};

export type ExperimentRow = {
  id: string;
  content_id: string;
  status: ExperimentStatus;
  created_at: string;
};

export type ExperimentVariantRow = {
  id: string;
  experiment_id: string;
  variant_id: string;
  blocks: unknown;
  weight: number;
};

export type TrackEventInput = {
  experimentId: string;
  variantId: string;
  eventType: ExperimentEventType;
  /** Stable subject id (authenticated profile id or anonymous UUID from client). */
  userId?: string | null;
};

export type VariantResultRow = {
  variantId: string;
  views: number;
  clicks: number;
  conversions: number;
  conversionRate: number;
};

export type ExperimentResults = {
  variants: VariantResultRow[];
  winner: { variantId: string; conversionRate: number; reason: string } | null;
};
