/**
 * U98 — Merge: baseline languages + admin overrides (settings JSON).
 */

import type { CmsStorageLocale, LanguageDefinition } from "@/lib/cms/schema/languageDefinitions";
import {
  cloneLanguageDefinition,
  getBaselineLanguageDefinition,
  listBaselineLanguageDefinitions,
} from "@/lib/cms/schema/languageDefinitions";

export type LanguageAdminOverride = {
  title?: string;
  cultureCode?: string;
  storageLocale?: CmsStorageLocale;
  isDefault?: boolean;
  isMandatory?: boolean;
  enabled?: boolean;
  fallbackCultureCode?: string | null;
};

export type LanguageOverridesFile = {
  version: number;
  byAlias: Record<string, LanguageAdminOverride>;
};

export type LanguageDefinitionsMergedPayload = {
  merged: Record<string, LanguageDefinition>;
  overrides: LanguageOverridesFile;
};

export const LANGUAGE_DEFINITION_OVERRIDES_KEY = "languageDefinitionOverrides" as const;

export function mergeLanguageDefinition(
  baseline: LanguageDefinition,
  override: LanguageAdminOverride | undefined,
): LanguageDefinition {
  if (!override) return cloneLanguageDefinition(baseline);
  return {
    ...baseline,
    title: override.title !== undefined ? String(override.title) : baseline.title,
    cultureCode: override.cultureCode !== undefined ? String(override.cultureCode).trim() : baseline.cultureCode,
    storageLocale:
      override.storageLocale === "nb" || override.storageLocale === "en"
        ? override.storageLocale
        : baseline.storageLocale,
    isDefault: override.isDefault !== undefined ? Boolean(override.isDefault) : baseline.isDefault,
    isMandatory: override.isMandatory !== undefined ? Boolean(override.isMandatory) : baseline.isMandatory,
    enabled: override.enabled !== undefined ? Boolean(override.enabled) : baseline.enabled,
    fallbackCultureCode:
      override.fallbackCultureCode === null
        ? undefined
        : override.fallbackCultureCode !== undefined
          ? String(override.fallbackCultureCode).trim() || undefined
          : baseline.fallbackCultureCode,
  };
}

export function mergeAllLanguagesWithOverrides(
  overridesFile: LanguageOverridesFile | null | undefined,
): Record<string, LanguageDefinition> {
  const byAlias = overridesFile?.byAlias && typeof overridesFile.byAlias === "object" ? overridesFile.byAlias : {};
  const out: Record<string, LanguageDefinition> = {};
  for (const baseline of listBaselineLanguageDefinitions()) {
    out[baseline.alias] = mergeLanguageDefinition(baseline, byAlias[baseline.alias]);
  }
  return out;
}

export function parseLanguageOverridesFromSettingsRoot(data: Record<string, unknown>): LanguageOverridesFile {
  const raw = data[LANGUAGE_DEFINITION_OVERRIDES_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: 1, byAlias: {} };
  }
  const o = raw as Record<string, unknown>;
  const version = typeof o.version === "number" && Number.isFinite(o.version) ? o.version : 1;
  const by = o.byAlias;
  if (!by || typeof by !== "object" || Array.isArray(by)) {
    return { version, byAlias: {} };
  }
  return { version, byAlias: by as Record<string, LanguageAdminOverride> };
}

export function buildLanguageAdminOverrideDiff(
  baseline: LanguageDefinition,
  edited: LanguageDefinition,
): LanguageAdminOverride {
  const diff: LanguageAdminOverride = {};
  if (baseline.title !== edited.title) diff.title = edited.title;
  if (baseline.cultureCode !== edited.cultureCode) diff.cultureCode = edited.cultureCode;
  if (baseline.storageLocale !== edited.storageLocale) diff.storageLocale = edited.storageLocale;
  if (baseline.isDefault !== edited.isDefault) diff.isDefault = edited.isDefault;
  if (baseline.isMandatory !== edited.isMandatory) diff.isMandatory = edited.isMandatory;
  if (baseline.enabled !== edited.enabled) diff.enabled = edited.enabled;
  if (baseline.fallbackCultureCode !== edited.fallbackCultureCode) {
    diff.fallbackCultureCode = edited.fallbackCultureCode ?? null;
  }
  return diff;
}

export function languagesEqual(a: LanguageDefinition, b: LanguageDefinition): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function cloneLanguageForForm(alias: string): LanguageDefinition | null {
  const base = getBaselineLanguageDefinition(alias);
  return base ? cloneLanguageDefinition(base) : null;
}
