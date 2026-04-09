/**
 * U96 — Merge: baseline document type definitions + admin overrides (settings JSON).
 */

import type {
  DocumentTypeDefinition,
  DocumentTypeGroupDefinition,
  PropertyTypeDefinition,
  PropertyVariation,
} from "@/lib/cms/schema/documentTypeDefinitions";
import {
  cloneDocumentTypeDefinition,
  getBaselineDocumentTypeDefinition,
  listBaselineDocumentTypeDefinitions,
} from "@/lib/cms/schema/documentTypeDefinitions";

export type DocumentTypeGroupOverride = {
  title?: string;
  description?: string;
};

export type DocumentTypePropertyOverride = {
  title?: string;
  description?: string;
  groupId?: string;
  dataTypeAlias?: string;
  /** U98 */
  variation?: PropertyVariation;
  defaultHint?: string;
  validation?: PropertyTypeDefinition["validation"];
  editorHints?: Record<string, unknown>;
};

export type DocumentTypeAdminOverride = {
  title?: string;
  description?: string;
  icon?: string;
  /** U97 */
  allowAtRoot?: boolean;
  allowedChildTypes?: string[];
  compositionAliases?: string[];
  templates?: string[];
  defaultTemplate?: string | null;
  isCollection?: boolean;
  groups?: Record<string, DocumentTypeGroupOverride>;
  properties?: Record<string, DocumentTypePropertyOverride>;
};

export type DocumentTypeOverridesFile = {
  version: number;
  byAlias: Record<string, DocumentTypeAdminOverride>;
};

export type DocumentTypeDefinitionsMergedPayload = {
  /** U97 — Effektiv (med composition-properties injisert) — brukes i content editor. */
  merged: Record<string, DocumentTypeDefinition>;
  /** U97 — Kjerne (uten composition-ekspansjon) — brukes i document type workspace. */
  mergedCore: Record<string, DocumentTypeDefinition>;
  overrides: DocumentTypeOverridesFile;
  compositionAliases?: string[];
  templateAliases?: string[];
};

export const DOCUMENT_TYPE_DEFINITION_OVERRIDES_KEY = "documentTypeDefinitionOverrides" as const;

function mergeGroup(base: DocumentTypeGroupDefinition, ov?: DocumentTypeGroupOverride): DocumentTypeGroupDefinition {
  if (!ov) return { ...base };
  return {
    ...base,
    title: ov.title !== undefined ? String(ov.title) : base.title,
    description: ov.description !== undefined ? String(ov.description) : base.description,
  };
}

function mergeProperty(base: PropertyTypeDefinition, ov?: DocumentTypePropertyOverride): PropertyTypeDefinition {
  if (!ov) return { ...base, validation: base.validation ? { ...base.validation } : undefined, editorHints: base.editorHints ? { ...base.editorHints } : undefined };
  const validation =
    ov.validation !== undefined
      ? { ...(base.validation ?? {}), ...ov.validation }
      : base.validation
        ? { ...base.validation }
        : undefined;
  const editorHints =
    ov.editorHints !== undefined
      ? { ...(base.editorHints ?? {}), ...ov.editorHints }
      : base.editorHints
        ? { ...base.editorHints }
        : undefined;
  return {
    ...base,
    title: ov.title !== undefined ? String(ov.title) : base.title,
    description: ov.description !== undefined ? String(ov.description) : base.description,
    groupId: ov.groupId !== undefined ? String(ov.groupId) : base.groupId,
    dataTypeAlias: ov.dataTypeAlias !== undefined ? String(ov.dataTypeAlias).trim() : base.dataTypeAlias,
    variation:
      ov.variation !== undefined
        ? ov.variation === "invariant"
          ? "invariant"
          : "culture"
        : base.variation,
    defaultHint: ov.defaultHint !== undefined ? String(ov.defaultHint) : base.defaultHint,
    validation,
    editorHints,
  };
}

export function mergeDocumentTypeDefinition(
  baseline: DocumentTypeDefinition,
  override: DocumentTypeAdminOverride | undefined,
): DocumentTypeDefinition {
  if (!override) return cloneDocumentTypeDefinition(baseline);
  const groups = baseline.groups.map((g) => mergeGroup(g, override.groups?.[g.id]));
  const properties = baseline.properties.map((p) => mergeProperty(p, override.properties?.[p.alias]));
  return {
    ...baseline,
    title: override.title !== undefined ? String(override.title) : baseline.title,
    description: override.description !== undefined ? String(override.description) : baseline.description,
    icon: (override.icon !== undefined ? String(override.icon).trim() : baseline.icon) as DocumentTypeDefinition["icon"],
    allowAtRoot: override.allowAtRoot !== undefined ? Boolean(override.allowAtRoot) : baseline.allowAtRoot,
    allowedChildTypes:
      override.allowedChildTypes !== undefined
        ? [...override.allowedChildTypes].map((x) => String(x).trim()).filter(Boolean)
        : [...baseline.allowedChildTypes],
    compositionAliases:
      override.compositionAliases !== undefined
        ? [...override.compositionAliases].map((x) => String(x).trim()).filter(Boolean)
        : [...baseline.compositionAliases],
    templates:
      override.templates !== undefined
        ? [...override.templates].map((x) => String(x).trim()).filter(Boolean)
        : [...baseline.templates],
    defaultTemplate:
      override.defaultTemplate !== undefined
        ? override.defaultTemplate === null || String(override.defaultTemplate).trim() === ""
          ? null
          : String(override.defaultTemplate).trim()
        : baseline.defaultTemplate,
    isCollection: override.isCollection !== undefined ? Boolean(override.isCollection) : baseline.isCollection,
    groups,
    properties,
    workspaceHint: baseline.workspaceHint,
    createPolicyNote: baseline.createPolicyNote,
  };
}

export function mergeAllDocumentTypesWithOverrides(
  overridesFile: DocumentTypeOverridesFile | null | undefined,
): Record<string, DocumentTypeDefinition> {
  const byAlias = overridesFile?.byAlias && typeof overridesFile.byAlias === "object" ? overridesFile.byAlias : {};
  const out: Record<string, DocumentTypeDefinition> = {};
  for (const baseline of listBaselineDocumentTypeDefinitions()) {
    out[baseline.alias] = mergeDocumentTypeDefinition(baseline, byAlias[baseline.alias]);
  }
  return out;
}

export function parseDocumentTypeOverridesFromSettingsRoot(data: Record<string, unknown>): DocumentTypeOverridesFile {
  const raw = data[DOCUMENT_TYPE_DEFINITION_OVERRIDES_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: 1, byAlias: {} };
  }
  const o = raw as Record<string, unknown>;
  const version = typeof o.version === "number" && Number.isFinite(o.version) ? o.version : 1;
  const by = o.byAlias;
  if (!by || typeof by !== "object" || Array.isArray(by)) {
    return { version, byAlias: {} };
  }
  return { version, byAlias: by as Record<string, DocumentTypeAdminOverride> };
}

/** Bygg override-diff fra baseline → ønsket form (for PUT). */
export function buildDocumentTypeAdminOverrideDiff(
  baseline: DocumentTypeDefinition,
  edited: DocumentTypeDefinition,
): DocumentTypeAdminOverride {
  const diff: DocumentTypeAdminOverride = {};
  if (baseline.title !== edited.title) diff.title = edited.title;
  if (baseline.description !== edited.description) diff.description = edited.description;
  if (baseline.icon !== edited.icon) diff.icon = edited.icon;
  if (baseline.allowAtRoot !== edited.allowAtRoot) diff.allowAtRoot = edited.allowAtRoot;
  if (JSON.stringify(baseline.allowedChildTypes) !== JSON.stringify(edited.allowedChildTypes)) {
    diff.allowedChildTypes = [...edited.allowedChildTypes];
  }
  if (JSON.stringify(baseline.compositionAliases) !== JSON.stringify(edited.compositionAliases)) {
    diff.compositionAliases = [...edited.compositionAliases];
  }
  if (JSON.stringify(baseline.templates) !== JSON.stringify(edited.templates)) {
    diff.templates = [...edited.templates];
  }
  if (baseline.defaultTemplate !== edited.defaultTemplate) {
    diff.defaultTemplate = edited.defaultTemplate;
  }
  if (Boolean(baseline.isCollection) !== Boolean(edited.isCollection)) {
    diff.isCollection = Boolean(edited.isCollection);
  }

  const groupDiff: Record<string, DocumentTypeGroupOverride> = {};
  for (const bg of baseline.groups) {
    const eg = edited.groups.find((g) => g.id === bg.id);
    if (!eg) continue;
    const gPatch: DocumentTypeGroupOverride = {};
    if (bg.title !== eg.title) gPatch.title = eg.title;
    if (bg.description !== eg.description) gPatch.description = eg.description;
    if (Object.keys(gPatch).length) groupDiff[bg.id] = gPatch;
  }
  if (Object.keys(groupDiff).length) diff.groups = groupDiff;

  const propDiff: Record<string, DocumentTypePropertyOverride> = {};
  for (const bp of baseline.properties) {
    const ep = edited.properties.find((p) => p.alias === bp.alias);
    if (!ep) continue;
    const pPatch: DocumentTypePropertyOverride = {};
    if (bp.title !== ep.title) pPatch.title = ep.title;
    if (bp.description !== ep.description) pPatch.description = ep.description;
    if (bp.groupId !== ep.groupId) pPatch.groupId = ep.groupId;
    if (bp.dataTypeAlias !== ep.dataTypeAlias) pPatch.dataTypeAlias = ep.dataTypeAlias;
    if (bp.defaultHint !== ep.defaultHint) pPatch.defaultHint = ep.defaultHint;
    if (JSON.stringify(bp.validation ?? null) !== JSON.stringify(ep.validation ?? null)) {
      pPatch.validation = ep.validation;
    }
    if (JSON.stringify(bp.editorHints ?? null) !== JSON.stringify(ep.editorHints ?? null)) {
      pPatch.editorHints = ep.editorHints;
    }
    if (bp.variation !== ep.variation) {
      pPatch.variation = ep.variation;
    }
    if (Object.keys(pPatch).length) propDiff[bp.alias] = pPatch;
  }
  if (Object.keys(propDiff).length) diff.properties = propDiff;

  return diff;
}

export function definitionsEqual(a: DocumentTypeDefinition, b: DocumentTypeDefinition): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function cloneDocumentTypeForForm(alias: string): DocumentTypeDefinition | null {
  const base = getBaselineDocumentTypeDefinition(alias);
  return base ? cloneDocumentTypeDefinition(base) : null;
}
