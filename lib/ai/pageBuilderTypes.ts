/**
 * Shared shapes for AI page builder output (before ids are assigned in normalizeLayoutBlocks).
 * Block types must stay aligned with lib/ai/layout.ts (normalizeLayoutBlocks).
 */

export const AI_PAGE_KNOWN_BLOCK_TYPES = ["hero", "richText", "text", "image", "cta"] as const;

export type AiPageKnownBlockType = (typeof AI_PAGE_KNOWN_BLOCK_TYPES)[number];

/** Raw block from the model: strict type + data object (no flat merge at validation time). */
export type AiBlock = {
  type: string;
  /** Model output; normalized in validateAiPage + normalizeLayoutBlocks. */
  data: Record<string, any>;
};

/** Parsed page draft from the model (preview-only; not persisted). */
export type AiPage = {
  title: string;
  blocks: AiBlock[];
};
