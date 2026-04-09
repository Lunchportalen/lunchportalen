/**
 * U95 — Pure merge: baseline (kode) + admin override (persistert). Én sannhet i runtime via merge, ikke to konkurrerende kilder.
 */
import type {
  BlockEditorDataTypeDefinition,
  BlockEditorDataTypeGroup,
  BlockEditorKind,
} from "@/lib/cms/blocks/blockEditorDataTypes";
import { listBlockEditorDataTypeDefinitions } from "@/lib/cms/blocks/blockEditorDataTypes";

/** Kun felt som kan overstyres av admin — ikke `alias` / `propertyKey`. */
export type BlockEditorDataTypeAdminOverride = {
  title?: string;
  description?: string;
  editorKind?: BlockEditorKind;
  allowedBlockAliases?: string[];
  groups?: BlockEditorDataTypeGroup[];
  minItems?: number;
  maxItems?: number;
  createButtonLabel?: string;
  editorOptions?: Record<string, unknown>;
  defaultViewMode?: "list" | "grid";
};

export type BlockEditorDataTypeOverridesFile = {
  version: number;
  byAlias: Record<string, BlockEditorDataTypeAdminOverride>;
};

export const BLOCK_EDITOR_DATA_TYPE_OVERRIDES_KEY = "blockEditorDataTypeOverrides" as const;

function cloneGroup(g: BlockEditorDataTypeGroup): BlockEditorDataTypeGroup {
  return { id: g.id, title: g.title, blockAliases: [...g.blockAliases] };
}

/** Deep enough for JSON roundtrip; returner ny definisjon (ikke muter baseline). */
export function mergeBlockEditorDataTypeDefinition(
  baseline: BlockEditorDataTypeDefinition,
  override: BlockEditorDataTypeAdminOverride | undefined,
): BlockEditorDataTypeDefinition {
  if (!override || typeof override !== "object") {
    return {
      ...baseline,
      allowedBlockAliases: [...baseline.allowedBlockAliases],
      groups: baseline.groups.map(cloneGroup),
      editorOptions: { ...baseline.editorOptions },
    };
  }
  const editorOptions =
    override.editorOptions !== undefined
      ? { ...baseline.editorOptions, ...override.editorOptions }
      : { ...baseline.editorOptions };
  return {
    alias: baseline.alias,
    propertyKey: baseline.propertyKey,
    title: override.title !== undefined ? String(override.title) : baseline.title,
    description: override.description !== undefined ? String(override.description) : baseline.description,
    editorKind: override.editorKind !== undefined ? override.editorKind : baseline.editorKind,
    allowedBlockAliases:
      override.allowedBlockAliases !== undefined
        ? [...override.allowedBlockAliases]
        : [...baseline.allowedBlockAliases],
    groups:
      override.groups !== undefined
        ? override.groups.map((g) => ({
            id: String(g.id),
            title: String(g.title),
            blockAliases: [...g.blockAliases],
          }))
        : baseline.groups.map(cloneGroup),
    minItems: override.minItems !== undefined ? Number(override.minItems) : baseline.minItems,
    maxItems: override.maxItems !== undefined ? Number(override.maxItems) : baseline.maxItems,
    createButtonLabel:
      override.createButtonLabel !== undefined ? String(override.createButtonLabel) : baseline.createButtonLabel,
    editorOptions,
    defaultViewMode: override.defaultViewMode !== undefined ? override.defaultViewMode : baseline.defaultViewMode,
  };
}

export function mergeAllBlockEditorDataTypesWithOverrides(
  overridesFile: BlockEditorDataTypeOverridesFile | null | undefined,
): Record<string, BlockEditorDataTypeDefinition> {
  const byAlias = overridesFile?.byAlias && typeof overridesFile.byAlias === "object" ? overridesFile.byAlias : {};
  const out: Record<string, BlockEditorDataTypeDefinition> = {};
  for (const baseline of listBlockEditorDataTypeDefinitions()) {
    out[baseline.alias] = mergeBlockEditorDataTypeDefinition(baseline, byAlias[baseline.alias]);
  }
  return out;
}

export function parseOverridesFromSettingsRoot(data: Record<string, unknown>): BlockEditorDataTypeOverridesFile {
  const raw = data[BLOCK_EDITOR_DATA_TYPE_OVERRIDES_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: 1, byAlias: {} };
  }
  const o = raw as Record<string, unknown>;
  const version = typeof o.version === "number" && Number.isFinite(o.version) ? o.version : 1;
  const by = o.byAlias;
  if (!by || typeof by !== "object" || Array.isArray(by)) {
    return { version, byAlias: {} };
  }
  return { version, byAlias: by as Record<string, BlockEditorDataTypeAdminOverride> };
}
