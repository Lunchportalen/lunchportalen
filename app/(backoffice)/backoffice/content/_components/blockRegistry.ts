"use client";

import { initPluginsOnce } from "@/lib/cms/plugins/loadPlugins";
import { getAllBlocks } from "@/lib/cms/plugins/registry";

export type BlockCategory = "content" | "layout" | "navigation" | "system" | "marketing";

export type BlockDefinition = {
  type: string;
  label: string;
  description: string;
  category: BlockCategory;
  tags: string[];
  preview?: string;
  previewText?: (data: Record<string, unknown>) => string;
  iconKey?: string;
  defaults: () => Record<string, unknown>;
};

function buildBlockRegistry(): BlockDefinition[] {
  initPluginsOnce();
  const blocks = getAllBlocks();
  return blocks.map((b) => ({
    type: b.type,
    label: b.label,
    description: b.description ?? b.label,
    category: b.category as BlockCategory,
    tags: [],
    preview: b.description ?? undefined,
    previewText: b.previewText,
    iconKey: b.type,
    defaults: b.defaults,
  }));
}

// Canonical registry for available blocks in the editor (Phase 18: from plugins).
// NOTE: `type` MUST match existing BlockType values handled by createBlock().
export const BLOCK_REGISTRY: BlockDefinition[] = buildBlockRegistry();

