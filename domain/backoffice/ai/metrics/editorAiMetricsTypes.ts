/**
 * Editor-AI metrics event types (metadata only, no content).
 * Used for AI Activation Rate and AI Assisted Save Rate.
 */

export type EditorAiFeature =
  | "improve_page"
  | "seo_optimize"
  | "seo_intelligence"
  | "seo_recommendation"
  | "generate_sections"
  | "structured_intent"
  | "seo_inline"
  | "hero_inline"
  | "cta_inline"
  | "page_builder"
  | "block_builder"
  | "screenshot_builder"
  | "layout_suggestions"
  | "visual_options"
  | "image_metadata"
  | "image_generate"
  | "image_suggestions"
  | "insert_ai_block"
  | "cro_analysis"
  | "cro_apply"
  | "cro_dismiss";

export type EditorAiEventBase = {
  pageId: string | null;
  variantId?: string | null;
  timestamp: string;
};

export type EditorOpenedEvent = EditorAiEventBase & {
  type: "editor_opened";
};

export type AiActionTriggeredEvent = EditorAiEventBase & {
  type: "ai_action_triggered";
  feature: EditorAiFeature;
};

export type AiResultReceivedEvent = EditorAiEventBase & {
  type: "ai_result_received";
  feature: EditorAiFeature;
  patchPresent: boolean;
};

export type AiPatchAppliedEvent = EditorAiEventBase & {
  type: "ai_patch_applied";
  feature: EditorAiFeature;
};

export type AiSaveAfterActionEvent = EditorAiEventBase & {
  type: "ai_save_after_action";
  feature?: EditorAiFeature | null;
};

/** Logged when an AI action fails (network, API, parse). Used for observability and fail-safe. */
export type AiErrorEvent = EditorAiEventBase & {
  type: "ai_error";
  feature?: EditorAiFeature | null;
  /** Short, safe message (no PII). */
  message: string;
  /** Optional: e.g. "network" | "api" | "parse" for aggregation. */
  kind?: string;
};

/** Logged when media API or media operation fails (fetch list, upload, alt). Same pipeline as ai_error. */
export type MediaErrorEvent = EditorAiEventBase & {
  type: "media_error";
  /** Short, safe message (no PII). */
  message: string;
  /** "fetch" | "upload" | "alt" for aggregation. */
  kind: "fetch" | "upload" | "alt";
};

/** Logged when screenshot/page builder returns warnings or dropped blocks. Observability. */
export type BuilderWarningEvent = EditorAiEventBase & {
  type: "builder_warning";
  feature: "screenshot_builder" | "page_builder";
  message: string;
  /** Number of warnings or dropped items. */
  count?: number;
};

/** Logged when content save/load/parse fails. Observability – same pipeline. */
export type ContentErrorEvent = EditorAiEventBase & {
  type: "content_error";
  message: string;
  kind: "save" | "load" | "parse";
};

export type EditorAiEvent =
  | EditorOpenedEvent
  | AiActionTriggeredEvent
  | AiResultReceivedEvent
  | AiPatchAppliedEvent
  | AiSaveAfterActionEvent
  | AiErrorEvent
  | MediaErrorEvent
  | BuilderWarningEvent
  | ContentErrorEvent;
