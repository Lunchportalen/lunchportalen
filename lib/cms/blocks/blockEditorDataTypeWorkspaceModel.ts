/**
 * U95 — Pure helpers for Block Editor Data Type settings workspace (dirty/save vs code baseline).
 */
import type { BlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypes";
import type { BlockEditorDataTypeAdminOverride } from "@/lib/cms/blocks/blockEditorDataTypeMerge";

function sameStringArray(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].map((x) => String(x).trim()).sort();
  const sb = [...b].map((x) => String(x).trim()).sort();
  return sa.join("\0") === sb.join("\0");
}

function normalizeGroupsJson(def: BlockEditorDataTypeDefinition): string {
  const normalized = def.groups.map((g) => ({
    id: g.id,
    title: g.title,
    blockAliases: [...g.blockAliases].map((x) => String(x).trim()).sort(),
  }));
  normalized.sort((a, b) => a.id.localeCompare(b.id, "nb"));
  return JSON.stringify(normalized);
}

/** Klone til redigerbar definisjon (mutable arrays). */
export function cloneBlockEditorDataTypeDefinition(d: BlockEditorDataTypeDefinition): BlockEditorDataTypeDefinition {
  return {
    ...d,
    allowedBlockAliases: [...d.allowedBlockAliases],
    groups: d.groups.map((g) => ({
      id: g.id,
      title: g.title,
      blockAliases: [...g.blockAliases],
    })),
    editorOptions: { ...d.editorOptions },
  };
}

export function buildBlockEditorDataTypeAdminOverrideDiff(
  baseline: BlockEditorDataTypeDefinition,
  edited: BlockEditorDataTypeDefinition,
): BlockEditorDataTypeAdminOverride {
  const o: BlockEditorDataTypeAdminOverride = {};
  if (edited.title !== baseline.title) o.title = edited.title;
  if (edited.description !== baseline.description) o.description = edited.description;
  if (edited.editorKind !== baseline.editorKind) o.editorKind = edited.editorKind;
  if (!sameStringArray(edited.allowedBlockAliases, baseline.allowedBlockAliases)) {
    o.allowedBlockAliases = [...edited.allowedBlockAliases];
  }
  if (normalizeGroupsJson(edited) !== normalizeGroupsJson(baseline)) {
    o.groups = edited.groups.map((g) => ({
      id: g.id,
      title: g.title,
      blockAliases: [...g.blockAliases],
    }));
  }
  if (edited.minItems !== baseline.minItems) o.minItems = edited.minItems;
  if (edited.maxItems !== baseline.maxItems) o.maxItems = edited.maxItems;
  if (edited.createButtonLabel !== baseline.createButtonLabel) o.createButtonLabel = edited.createButtonLabel;
  if (JSON.stringify(edited.editorOptions) !== JSON.stringify(baseline.editorOptions)) {
    o.editorOptions = { ...edited.editorOptions };
  }
  if (edited.defaultViewMode !== baseline.defaultViewMode) o.defaultViewMode = edited.defaultViewMode;
  return o;
}

export function stableSerializeBlockEditorDataTypeDefinition(d: BlockEditorDataTypeDefinition): string {
  const groups = d.groups
    .map((g) => ({
      id: g.id,
      title: g.title,
      blockAliases: [...g.blockAliases].map((x) => String(x).trim()).sort(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id, "nb"));
  return JSON.stringify({
    alias: d.alias,
    propertyKey: d.propertyKey,
    title: d.title,
    description: d.description,
    editorKind: d.editorKind,
    allowedBlockAliases: [...d.allowedBlockAliases].map((x) => String(x).trim()).sort(),
    groups,
    minItems: d.minItems,
    maxItems: d.maxItems,
    createButtonLabel: d.createButtonLabel,
    editorOptions: d.editorOptions,
    defaultViewMode: d.defaultViewMode ?? null,
  });
}

export function definitionsEqual(a: BlockEditorDataTypeDefinition, b: BlockEditorDataTypeDefinition): boolean {
  return stableSerializeBlockEditorDataTypeDefinition(a) === stableSerializeBlockEditorDataTypeDefinition(b);
}
