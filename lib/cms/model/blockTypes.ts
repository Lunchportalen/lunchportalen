/**
 * Canonical CMS block list model (single source of truth).
 * Used by backoffice content editor and AI patch layer.
 */

export type BlockNode = {
  id: string;
  type: string;
  data?: Record<string, unknown>;
};

export type BlockList = {
  version: 1;
  blocks: BlockNode[];
  meta?: Record<string, unknown>;
};