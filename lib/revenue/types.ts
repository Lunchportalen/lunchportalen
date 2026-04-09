/**
 * Revenue attribution payloads — strict shapes, no inferred conversions.
 */

export const AI_SOCIAL_ATTRIBUTION_SOURCE = "ai_social" as const;

export type AiSocialAttributionSource = typeof AI_SOCIAL_ATTRIBUTION_SOURCE;

/** Persisted on orders.attribution (jsonb) — additive, nullable i DB. */
export type OrderAttributionRecord = {
  postId?: string;
  source?: AiSocialAttributionSource;
  productId?: string;
  /** Epoch ms when captured client-side (traceability). */
  capturedAt?: number;
  /** Valgfritt — lukket sløyfe mot kampanje/creative/konto (kun strenge ID-er). */
  campaignId?: string;
  creativeId?: string;
  accountId?: string;
};
