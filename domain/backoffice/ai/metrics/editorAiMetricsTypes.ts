/**
 * Editor-AI metrics event types (metadata only, no content).
 * Used for AI Activation Rate and AI Assisted Save Rate.
 */

export type EditorAiFeature =
  | "improve_page"
  | "seo_optimize"
  | "generate_sections"
  | "structured_intent"
  | "seo_inline"
  | "hero_inline"
  | "cta_inline";

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

export type EditorAiEvent =
  | EditorOpenedEvent
  | AiActionTriggeredEvent
  | AiResultReceivedEvent
  | AiPatchAppliedEvent
  | AiSaveAfterActionEvent;
