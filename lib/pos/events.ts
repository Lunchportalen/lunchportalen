import "server-only";

/**
 * Product Operating System — domain events (fire-and-forget; debounced handler in `lib/pos/eventHandler.ts`).
 */
export type PosEventAiUsageUpdated = {
  type: "ai_usage_updated";
  company_id?: string;
  tool?: string;
};

export type PosEventVariantPerformanceUpdated = {
  type: "variant_performance_updated";
  /** A/B experiment (experiment_events / evaluator). */
  experiment_id?: string;
  variant_id?: string;
  experiment_event_type?: "view" | "impression" | "click" | "conversion";
  /** Public content analytics (`content_analytics_events`). */
  analytics_event_type?: "page_view" | "search" | "cta_click" | "scroll_depth" | "form_submit" | "conversion";
  page_id?: string | null;
  variant_id_analytics?: string | null;
};

export type PosEventCmsContentChanged = {
  type: "cms_content_changed";
  page_id: string;
  locale?: string;
  environment?: string;
  /** Variant `body` (blocks JSON) for scoped {@link runAIAnalysis} in POS cycle. */
  body_sample?: unknown;
};

export type PosEventSignupCompleted = {
  type: "signup_completed";
  company_id?: string;
};

export type PosEvent =
  | PosEventAiUsageUpdated
  | PosEventVariantPerformanceUpdated
  | PosEventCmsContentChanged
  | PosEventSignupCompleted;

export type PosEventType = PosEvent["type"];

export const POS_EVENT_TYPES: readonly PosEventType[] = [
  "ai_usage_updated",
  "variant_performance_updated",
  "cms_content_changed",
  "signup_completed",
] as const;
