import type { CMSBlockFieldSchema } from "@/lib/cms/plugins/types";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";
import { initPluginsOnce } from "@/lib/cms/plugins/loadPlugins";
import { getAllBlocks, getBlockDefinition } from "@/lib/cms/plugins/registry";

export type BackofficeBlockCategory = "content" | "layout" | "navigation" | "system" | "marketing";

export type BackofficeBlockDefinition = {
  type: string;
  label: string;
  shortTitle: string;
  description: string;
  whenToUse: string;
  differsFrom: Partial<Record<string, string>>;
  libraryGroup: string;
  category: BackofficeBlockCategory;
  tags: string[];
  preview?: string;
  previewText?: (data: Record<string, unknown>) => string;
  iconKey?: string;
  defaults: () => Record<string, unknown>;
  fields?: CMSBlockFieldSchema[];
  /** Umbraco-style contract metadata (U87) */
  propertyEditorComponent?: string;
  canvasViewComponent?: string;
  validationRules?: { id: string; message: string }[];
  contentSections?: { id: string; label: string; hint?: string }[];
  settingsSections?: { id: string; label: string; hint?: string }[];
  structureSections?: { id: string; label: string; hint?: string }[];
};

let cachedCatalog: BackofficeBlockDefinition[] | null = null;

function buildBackofficeBlockCatalog(): BackofficeBlockDefinition[] {
  initPluginsOnce();
  return getAllBlocks().map((block) => {
    const canon = getBlockTypeDefinition(block.type);
    return {
      type: block.type,
      label: block.label,
      shortTitle: canon?.shortTitle ?? block.label,
      description: block.description ?? block.label,
      whenToUse: canon?.whenToUse ?? "",
      differsFrom: canon?.differsFrom ?? {},
      libraryGroup: canon?.libraryGroup ?? block.category,
      category: block.category as BackofficeBlockCategory,
      tags: [block.type, block.category, ...(canon ? [canon.libraryGroup] : [])],
      preview: block.description ?? undefined,
      previewText: block.previewText,
      iconKey: block.icon ?? block.type,
      defaults: block.defaults,
      fields: block.fields,
      propertyEditorComponent: canon?.propertyEditorComponent,
      canvasViewComponent: canon?.canvasViewComponent,
      validationRules: canon?.validationRules,
      contentSections: canon?.contentSections,
      settingsSections: canon?.settingsSections,
      structureSections: canon?.structureSections,
    };
  });
}

export function getBackofficeBlockCatalog(): BackofficeBlockDefinition[] {
  if (!cachedCatalog) {
    cachedCatalog = buildBackofficeBlockCatalog();
  }
  return [...cachedCatalog];
}

export function getBackofficeBlockDefinition(type: string): BackofficeBlockDefinition | null {
  initPluginsOnce();
  const definition = getBlockDefinition(type);
  if (!definition) return null;
  const canon = getBlockTypeDefinition(type);
  return {
    type: definition.type,
    label: definition.label,
    shortTitle: canon?.shortTitle ?? definition.label,
    description: definition.description ?? definition.label,
    whenToUse: canon?.whenToUse ?? "",
    differsFrom: canon?.differsFrom ?? {},
    libraryGroup: canon?.libraryGroup ?? definition.category,
    category: definition.category as BackofficeBlockCategory,
    tags: [definition.type, definition.category, ...(canon ? [canon.libraryGroup] : [])],
    preview: definition.description ?? undefined,
    previewText: definition.previewText,
    iconKey: definition.icon ?? definition.type,
    defaults: definition.defaults,
    fields: definition.fields,
    propertyEditorComponent: canon?.propertyEditorComponent,
    canvasViewComponent: canon?.canvasViewComponent,
    validationRules: canon?.validationRules,
    contentSections: canon?.contentSections,
    settingsSections: canon?.settingsSections,
    structureSections: canon?.structureSections,
  };
}

export function isBackofficeBlockType(type: string): boolean {
  return Boolean(getBackofficeBlockDefinition(type));
}

export function createBackofficeBlockDraft(
  type: string,
  extraDefaults?: Record<string, unknown>,
): Record<string, unknown> | null {
  const definition = getBackofficeBlockDefinition(type);
  if (!definition) return null;
  return {
    type,
    ...(definition.defaults?.() ?? {}),
    ...(extraDefaults ?? {}),
  };
}
