/**
 * U97 — Merge: baseline composition definitions + admin overrides (settings JSON).
 */

import type { CompositionDefinition } from "@/lib/cms/schema/compositionDefinitions";
import {
  cloneCompositionDefinition,
  getBaselineCompositionDefinition,
  listBaselineCompositionDefinitions,
} from "@/lib/cms/schema/compositionDefinitions";
import type {
  DocumentTypeGroupDefinition,
  PropertyTypeDefinition,
  PropertyVariation,
} from "@/lib/cms/schema/documentTypeDefinitions";

export type CompositionGroupOverride = {
  title?: string;
  description?: string;
};

export type CompositionPropertyOverride = {
  title?: string;
  description?: string;
  groupId?: string;
  dataTypeAlias?: string;
  variation?: PropertyVariation;
  defaultHint?: string;
  validation?: PropertyTypeDefinition["validation"];
  editorHints?: Record<string, unknown>;
};

export type CompositionAdminOverride = {
  title?: string;
  description?: string;
  groups?: Record<string, CompositionGroupOverride>;
  properties?: Record<string, CompositionPropertyOverride>;
};

export type CompositionOverridesFile = {
  version: number;
  byAlias: Record<string, CompositionAdminOverride>;
};

export type CompositionDefinitionsMergedPayload = {
  merged: Record<string, CompositionDefinition>;
  overrides: CompositionOverridesFile;
};

export const COMPOSITION_DEFINITION_OVERRIDES_KEY = "compositionDefinitionOverrides" as const;

function mergeGroup(base: DocumentTypeGroupDefinition, ov?: CompositionGroupOverride): DocumentTypeGroupDefinition {
  if (!ov) return { ...base };
  return {
    ...base,
    title: ov.title !== undefined ? String(ov.title) : base.title,
    description: ov.description !== undefined ? String(ov.description) : base.description,
  };
}

function mergeProperty(base: PropertyTypeDefinition, ov?: CompositionPropertyOverride): PropertyTypeDefinition {
  if (!ov) {
    return {
      ...base,
      validation: base.validation ? { ...base.validation } : undefined,
      editorHints: base.editorHints ? { ...base.editorHints } : undefined,
    };
  }
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

export function mergeCompositionDefinition(
  baseline: CompositionDefinition,
  override: CompositionAdminOverride | undefined,
): CompositionDefinition {
  if (!override) return cloneCompositionDefinition(baseline);
  const groups = baseline.groups.map((g) => mergeGroup(g, override.groups?.[g.id]));
  const properties = baseline.properties.map((p) => mergeProperty(p, override.properties?.[p.alias]));
  return {
    ...baseline,
    title: override.title !== undefined ? String(override.title) : baseline.title,
    description: override.description !== undefined ? String(override.description) : baseline.description,
    allowedDocumentTypeAliases: [...baseline.allowedDocumentTypeAliases],
    groups,
    properties,
  };
}

export function mergeAllCompositionsWithOverrides(
  overridesFile: CompositionOverridesFile | null | undefined,
): Record<string, CompositionDefinition> {
  const byAlias = overridesFile?.byAlias && typeof overridesFile.byAlias === "object" ? overridesFile.byAlias : {};
  const out: Record<string, CompositionDefinition> = {};
  for (const baseline of listBaselineCompositionDefinitions()) {
    out[baseline.alias] = mergeCompositionDefinition(baseline, byAlias[baseline.alias]);
  }
  return out;
}

export function parseCompositionOverridesFromSettingsRoot(data: Record<string, unknown>): CompositionOverridesFile {
  const raw = data[COMPOSITION_DEFINITION_OVERRIDES_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: 1, byAlias: {} };
  }
  const o = raw as Record<string, unknown>;
  const version = typeof o.version === "number" && Number.isFinite(o.version) ? o.version : 1;
  const by = o.byAlias;
  if (!by || typeof by !== "object" || Array.isArray(by)) {
    return { version, byAlias: {} };
  }
  return { version, byAlias: by as Record<string, CompositionAdminOverride> };
}

export function buildCompositionAdminOverrideDiff(
  baseline: CompositionDefinition,
  edited: CompositionDefinition,
): CompositionAdminOverride {
  const diff: CompositionAdminOverride = {};
  if (baseline.title !== edited.title) diff.title = edited.title;
  if (baseline.description !== edited.description) diff.description = edited.description;

  const groupDiff: Record<string, CompositionGroupOverride> = {};
  for (const bg of baseline.groups) {
    const eg = edited.groups.find((g) => g.id === bg.id);
    if (!eg) continue;
    const gPatch: CompositionGroupOverride = {};
    if (bg.title !== eg.title) gPatch.title = eg.title;
    if (bg.description !== eg.description) gPatch.description = eg.description;
    if (Object.keys(gPatch).length) groupDiff[bg.id] = gPatch;
  }
  if (Object.keys(groupDiff).length) diff.groups = groupDiff;

  const propDiff: Record<string, CompositionPropertyOverride> = {};
  for (const bp of baseline.properties) {
    const ep = edited.properties.find((p) => p.alias === bp.alias);
    if (!ep) continue;
    const pPatch: CompositionPropertyOverride = {};
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
    if (Object.keys(pPatch).length) propDiff[bp.alias] = pPatch;
  }
  if (Object.keys(propDiff).length) diff.properties = propDiff;

  return diff;
}

export function definitionsEqualComposition(a: CompositionDefinition, b: CompositionDefinition): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function cloneCompositionForForm(alias: string): CompositionDefinition | null {
  const base = getBaselineCompositionDefinition(alias);
  return base ? cloneCompositionDefinition(base) : null;
}
