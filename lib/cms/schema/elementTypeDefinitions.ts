/**
 * U96 — Element Type = Umbraco-lignende kontrakt over block entries (content + settings + editor identity).
 * Kilden for faktisk blokkform er fortsatt `blockTypeDefinitions`; dette laget eksponerer et eksplisitt schema-API.
 */

import type { BlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";
import {
  BLOCK_TYPE_DEFINITION_BY_ALIAS,
  getBlockTypeDefinition,
  KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS,
} from "@/lib/cms/blocks/blockTypeDefinitions";

export const U96_ELEMENT_TYPE_MARK = "U96_ELEMENT_TYPE_LAYER";

export type ElementTypeFieldRef = {
  key: string;
  label: string;
  kind: string;
  layer: "content" | "settings" | "structure";
};

export type ElementTypeDefinition = {
  /** Samme som block entry alias (f.eks. hero, cards). */
  alias: string;
  title: string;
  description: string;
  shortTitle: string;
  icon: BlockTypeDefinition["icon"];
  propertyEditorComponent: string;
  canvasViewComponent: string;
  contentSectionLabels: string[];
  settingsSectionLabels: string[];
  structureSectionLabels: string[];
  fieldRefs: ElementTypeFieldRef[];
  validationRuleIds: string[];
};

function toElementType(d: BlockTypeDefinition): ElementTypeDefinition {
  const fieldRefs: ElementTypeFieldRef[] = (d.fields ?? []).map((f) => ({
    key: f.key,
    label: f.label,
    kind: f.kind,
    layer: "content",
  }));
  return {
    alias: d.alias,
    title: d.title,
    description: d.description,
    shortTitle: d.shortTitle,
    icon: d.icon,
    propertyEditorComponent: d.propertyEditorComponent,
    canvasViewComponent: d.canvasViewComponent,
    contentSectionLabels: d.contentSections.map((s) => s.label),
    settingsSectionLabels: d.settingsSections.map((s) => s.label),
    structureSectionLabels: d.structureSections.map((s) => s.label),
    fieldRefs,
    validationRuleIds: d.validationRules.map((r) => r.id),
  };
}

export function listElementTypeDefinitions(): ElementTypeDefinition[] {
  return Object.values(BLOCK_TYPE_DEFINITION_BY_ALIAS).map(toElementType);
}

export function getElementTypeDefinition(alias: string): ElementTypeDefinition | undefined {
  const d = getBlockTypeDefinition(alias);
  return d ? toElementType(d) : undefined;
}

/** Alias som U91/U93 bruker som entry-modell — «hoved»-elementtyper for parity. */
export function listContractElementTypeAliases(): readonly string[] {
  return KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS as unknown as string[];
}

/** Data type allowlist = element type aliases (block entry aliases). */
export function dataTypeAllowsElementTypeAlias(dataTypeAllowedAliases: readonly string[], elementAlias: string): boolean {
  return dataTypeAllowedAliases.includes(String(elementAlias).trim());
}

/** Alle registrerte element-alias (alle block type definitions). */
export function listRegisteredElementTypeAliases(): string[] {
  return Object.keys(BLOCK_TYPE_DEFINITION_BY_ALIAS);
}
