/**
 * Maps CMS BlockNode[] (API / body parse) to editor Block[] for scoring and safe transforms.
 * Delegates shape normalization to `normalizeBlock` (single behavioural source).
 */

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { normalizeBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";
import type { BlockNode } from "@/lib/cms/model/blockTypes";

/**
 * Converts a parsed CMS node to an editor block.
 */
export function blockNodeToEditorBlock(node: BlockNode): Block | null {
  const data = node.data ?? {};
  const row = { id: node.id, type: node.type, ...data, ...(node.config ? { config: node.config } : {}) };
  return normalizeBlock(row);
}

export function blockNodesToEditorBlocks(nodes: BlockNode[]): Block[] {
  return nodes.map(blockNodeToEditorBlock).filter((b): b is Block => Boolean(b));
}
