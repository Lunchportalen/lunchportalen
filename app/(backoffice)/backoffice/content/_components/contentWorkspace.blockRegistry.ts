/**
 * Workspace block editing: single entry for field-schema validation used in live preview hints.
 * Delegates to `blockFieldSchemas` (canonical editor field definitions per block type).
 */

import { getBlockFieldSchema, validateEditorField } from "./blockFieldSchemas";
import type { Block } from "./editorBlockTypes";

export function workspaceFieldHintsForBlock(block: Block): Record<string, string> | undefined {
  const schema = getBlockFieldSchema(block.type);
  if (schema.length === 0) return undefined;
  const rec = block as Record<string, unknown>;
  const hints: Record<string, string> = {};
  for (const f of schema) {
    const msg = validateEditorField(block.type, f, rec);
    if (msg) hints[f.key] = msg;
  }
  return Object.keys(hints).length > 0 ? hints : undefined;
}
