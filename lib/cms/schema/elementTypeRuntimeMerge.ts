/**
 * U96B — Element Type runtime display: baseline (blockTypeDefinitions) + admin overrides (settings JSON).
 */

import { getBlockTypeDefinition, BLOCK_TYPE_DEFINITION_BY_ALIAS } from "@/lib/cms/blocks/blockTypeDefinitions";

export type ElementTypeRuntimeAdminOverride = {
  title?: string;
  description?: string;
  shortTitle?: string;
  /** Editor-facing help (library + inspector) */
  editorHelpText?: string;
};

export type ElementTypeRuntimeOverridesFile = {
  version: number;
  byAlias: Record<string, ElementTypeRuntimeAdminOverride>;
};

export type ElementTypeRuntimeMergedEntry = {
  alias: string;
  title: string;
  description: string;
  shortTitle: string;
  editorHelpText: string;
};

export type ElementTypeRuntimeMergedPayload = {
  merged: Record<string, ElementTypeRuntimeMergedEntry>;
  overrides: ElementTypeRuntimeOverridesFile;
  /** Alle registrerte alias (API GET) */
  aliases?: string[];
};

export const ELEMENT_TYPE_RUNTIME_OVERRIDES_KEY = "elementTypeRuntimeOverrides" as const;

function baselineEntry(alias: string): ElementTypeRuntimeMergedEntry | null {
  const canon = getBlockTypeDefinition(alias);
  if (!canon) return null;
  return {
    alias,
    title: canon.title,
    description: canon.description,
    shortTitle: canon.shortTitle,
    editorHelpText: "",
  };
}

function mergeEntry(alias: string, ov?: ElementTypeRuntimeAdminOverride): ElementTypeRuntimeMergedEntry | null {
  const base = baselineEntry(alias);
  if (!base) return null;
  if (!ov) return base;
  return {
    alias,
    title: ov.title !== undefined ? String(ov.title) : base.title,
    description: ov.description !== undefined ? String(ov.description) : base.description,
    shortTitle: ov.shortTitle !== undefined ? String(ov.shortTitle) : base.shortTitle,
    editorHelpText: ov.editorHelpText !== undefined ? String(ov.editorHelpText) : base.editorHelpText,
  };
}

export function mergeAllElementTypeRuntimeWithOverrides(
  overridesFile: ElementTypeRuntimeOverridesFile | null | undefined,
): Record<string, ElementTypeRuntimeMergedEntry> {
  const byAlias = overridesFile?.byAlias && typeof overridesFile.byAlias === "object" ? overridesFile.byAlias : {};
  const out: Record<string, ElementTypeRuntimeMergedEntry> = {};
  for (const alias of Object.keys(BLOCK_TYPE_DEFINITION_BY_ALIAS)) {
    const merged = mergeEntry(alias, byAlias[alias]);
    if (merged) out[alias] = merged;
  }
  return out;
}

export function parseElementTypeRuntimeOverridesFromSettingsRoot(data: Record<string, unknown>): ElementTypeRuntimeOverridesFile {
  const raw = data[ELEMENT_TYPE_RUNTIME_OVERRIDES_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: 1, byAlias: {} };
  }
  const o = raw as Record<string, unknown>;
  const version = typeof o.version === "number" && Number.isFinite(o.version) ? o.version : 1;
  const by = o.byAlias;
  if (!by || typeof by !== "object" || Array.isArray(by)) {
    return { version, byAlias: {} };
  }
  return { version, byAlias: by as Record<string, ElementTypeRuntimeAdminOverride> };
}

export function buildElementTypeRuntimeAdminOverrideDiff(
  baseline: ElementTypeRuntimeMergedEntry,
  edited: ElementTypeRuntimeMergedEntry,
): ElementTypeRuntimeAdminOverride {
  const diff: ElementTypeRuntimeAdminOverride = {};
  if (baseline.title !== edited.title) diff.title = edited.title;
  if (baseline.description !== edited.description) diff.description = edited.description;
  if (baseline.shortTitle !== edited.shortTitle) diff.shortTitle = edited.shortTitle;
  if (baseline.editorHelpText !== edited.editorHelpText) diff.editorHelpText = edited.editorHelpText;
  return diff;
}

export function elementTypeRuntimeEntriesEqual(a: ElementTypeRuntimeMergedEntry, b: ElementTypeRuntimeMergedEntry): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function cloneElementTypeRuntimeForForm(alias: string): ElementTypeRuntimeMergedEntry | null {
  const b = baselineEntry(alias);
  return b ? { ...b } : null;
}
