/**
 * Canonical CMS block list model (single source of truth).
 * Used by backoffice content editor and AI patch layer.
 */

import type { BlockConfig } from "@/lib/cms/design/designContract";

export type { BlockConfig };

export type BlockNode = {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  /** Theme/layout only — never colors, spacing, or typography literals. */
  config?: BlockConfig;
};

export type BlockList = {
  version: 1;
  blocks: BlockNode[];
  meta?: Record<string, unknown>;
};
