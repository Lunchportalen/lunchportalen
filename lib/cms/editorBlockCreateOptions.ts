/**
 * Block «create options» for content workspace (Umbraco-lignende entity create list).
 * Public API kept stable for settings/governance callers, but derives from the canonical block catalog.
 */

import { getBackofficeBlockCatalog } from "@/lib/cms/backofficeBlockCatalog";

export type EditorBlockCreateOption = {
  type: string;
  label: string;
  description: string;
};

export const EDITOR_BLOCK_CREATE_OPTIONS: readonly EditorBlockCreateOption[] = getBackofficeBlockCatalog().map(
  (definition) => ({
    type: definition.type,
    label: definition.label,
    description: definition.description,
  }),
);
