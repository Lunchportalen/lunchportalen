import { getDocType } from "@/lib/cms/contentDocumentTypes";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import { getBodyPropertyDefinition } from "@/lib/cms/schema/documentTypeDefinitions";

/**
 * U94 — Block Editor Data Type definitions (Umbraco-style composition property config).
 *
 * Separate from Block Entry definitions (`blockTypeDefinitions.ts`):
 * - Data Type = where/how blocks may be used (allowlist, groups, limits, labels, editor options).
 * - Block Entry = what a block is (content/settings models, property editor, canvas view, defaults).
 */

export type BlockEditorKind = "block_list" | "block_grid";

export type BlockEditorDataTypeGroup = {
  id: string;
  title: string;
  /** Block entry aliases belonging to this library group for this data type. */
  blockAliases: readonly string[];
};

export type BlockEditorDataTypeDefinition = {
  alias: string;
  title: string;
  description: string;
  /**
   * Logical property key this data type is bound to (page workspace uses body blocks).
   */
  propertyKey: "body.blocks";
  editorKind: BlockEditorKind;
  /**
   * Tillatte block entry-alias — i U96-terminologi: **Element Type**-alias (samme som `blockTypeDefinitions.alias`).
   */
  allowedBlockAliases: readonly string[];
  /** When non-empty, Block library "Blokkatalog" sections follow this order; leftover allowed aliases go under «Andre tillatte». */
  groups: readonly BlockEditorDataTypeGroup[];
  minItems: number;
  maxItems: number;
  createButtonLabel: string;
  editorOptions: Record<string, unknown>;
  defaultViewMode?: "list" | "grid";
};

const ALL_MARKETING_ALIASES = [
  "hero",
  "hero_full",
  "hero_bleed",
  "richText",
  "image",
  "cta",
  "banner",
  "cards",
  "zigzag",
  "pricing",
  "grid",
  "divider",
  "form",
  "relatedLinks",
] as const;

const DEFINITIONS: readonly BlockEditorDataTypeDefinition[] = [
  {
    alias: "page_marketing_blocks",
    title: "Sideinnhold (marketing)",
    description:
      "Full markedsføringspalette for ordinære sider — hero-familie, innhold, seksjoner og CTA. Standard data type for dokumenttypen «page».",
    propertyKey: "body.blocks",
    editorKind: "block_list",
    allowedBlockAliases: ALL_MARKETING_ALIASES,
    groups: [
      {
        id: "heroes",
        title: "Hero-familie",
        blockAliases: ["hero", "hero_full", "hero_bleed"],
      },
      {
        id: "body",
        title: "Innholdsblokker",
        blockAliases: ["richText", "image", "divider", "banner", "form"],
      },
      {
        id: "structure",
        title: "Seksjoner",
        blockAliases: ["cards", "zigzag", "pricing", "grid"],
      },
      {
        id: "conversion",
        title: "Handling og lenker",
        blockAliases: ["cta", "relatedLinks"],
      },
    ],
    minItems: 0,
    maxItems: 120,
    createButtonLabel: "Legg til innhold",
    editorOptions: {
      showStructureRail: true,
      allowInlineReorder: true,
    },
    defaultViewMode: "list",
  },
  {
    alias: "compact_page_blocks",
    title: "Kompakt blokkspektrum",
    description:
      "Smalt utvalg for enkle landingsstriper — uten pricing, zigzag, grid, relatedLinks og utvidet hero-familie.",
    propertyKey: "body.blocks",
    editorKind: "block_list",
    allowedBlockAliases: ["hero", "richText", "image", "cards", "cta"],
    groups: [
      {
        id: "core",
        title: "Kjerne",
        blockAliases: ["hero", "richText", "image"],
      },
      {
        id: "sections",
        title: "Seksjon",
        blockAliases: ["cards"],
      },
      {
        id: "conversion",
        title: "Handling",
        blockAliases: ["cta"],
      },
    ],
    minItems: 0,
    maxItems: 40,
    createButtonLabel: "Legg til kompakt blokk",
    editorOptions: {
      showStructureRail: true,
    },
    defaultViewMode: "list",
  },
  {
    alias: "page_micro_blocks",
    title: "Micro landing (maks 3)",
    description: "Minimal allowlist og hard tak på antall blokker — for grenseverifikasjon i editor.",
    propertyKey: "body.blocks",
    editorKind: "block_list",
    allowedBlockAliases: ["hero", "richText", "cta"],
    groups: [
      {
        id: "all",
        title: "Tillatte blokker",
        blockAliases: ["hero", "richText", "cta"],
      },
    ],
    minItems: 1,
    maxItems: 3,
    createButtonLabel: "Legg til blokk (maks 3)",
    editorOptions: {
      enforceHardCap: true,
    },
    defaultViewMode: "list",
  },
] as const;

const BY_ALIAS = new Map<string, BlockEditorDataTypeDefinition>(
  DEFINITIONS.map((d) => [d.alias, d]),
);

/** Canonical list for tests and tooling — same source as `getBlockEditorDataType`. */
export function listBlockEditorDataTypeDefinitions(): readonly BlockEditorDataTypeDefinition[] {
  return DEFINITIONS;
}

export function listBlockEditorDataTypeAliases(): string[] {
  return DEFINITIONS.map((d) => d.alias);
}

export function getBlockEditorDataType(alias: string): BlockEditorDataTypeDefinition | undefined {
  const k = String(alias ?? "").trim();
  if (!k) return undefined;
  return BY_ALIAS.get(k);
}

/**
 * Effektiv Block Editor Data Type-alias for dokumenttype: merged Document Type property `body` vinner over code-baseline entry.
 */
export function getBlockEditorDataTypeAliasForDocument(
  documentTypeAlias: string | null | undefined,
  mergedDocumentTypes?: Record<string, DocumentTypeDefinition> | null,
): string | undefined {
  const a = documentTypeAlias != null ? String(documentTypeAlias).trim() : "";
  if (!a) return undefined;
  const mergedDoc = mergedDocumentTypes?.[a];
  const body = mergedDoc ? getBodyPropertyDefinition(mergedDoc) : undefined;
  const fromMerged = body?.dataTypeAlias?.trim();
  if (fromMerged) return fromMerged;
  return getDocType(a)?.blockEditorDataTypeAlias?.trim();
}

/**
 * U95/U96 — `mergedByDataTypeAlias`: admin data types; `mergedDocumentTypes`: admin document types (property → data type).
 */
export function getBlockEditorDataTypeForDocument(
  documentTypeAlias: string | null | undefined,
  mergedByDataTypeAlias?: Record<string, BlockEditorDataTypeDefinition> | null,
  mergedDocumentTypes?: Record<string, DocumentTypeDefinition> | null,
): BlockEditorDataTypeDefinition | undefined {
  const a = documentTypeAlias != null ? String(documentTypeAlias).trim() : "";
  if (!a) return undefined;
  const dtAlias = getBlockEditorDataTypeAliasForDocument(a, mergedDocumentTypes);
  if (!dtAlias) return undefined;
  if (mergedByDataTypeAlias && mergedByDataTypeAlias[dtAlias]) {
    return mergedByDataTypeAlias[dtAlias];
  }
  return getBlockEditorDataType(dtAlias);
}

/** Data type → tillatte elementtyper (samme liste som `allowedBlockAliases`). */
export function getAllowedElementTypeAliasesForDataType(dt: BlockEditorDataTypeDefinition): readonly string[] {
  return dt.allowedBlockAliases;
}

export function resolveAllowedBlockAliasesForDocument(
  documentTypeAlias: string | null | undefined,
  mergedByDataTypeAlias?: Record<string, BlockEditorDataTypeDefinition> | null,
  mergedDocumentTypes?: Record<string, DocumentTypeDefinition> | null,
): string[] | null {
  const dt = getBlockEditorDataTypeForDocument(documentTypeAlias, mergedByDataTypeAlias, mergedDocumentTypes);
  if (dt) return [...dt.allowedBlockAliases];
  return null;
}

/** @returns human-readable error, or null if OK */
export function validateBlockCountForDataType(
  documentTypeAlias: string | null | undefined,
  blockCount: number,
  mergedByDataTypeAlias?: Record<string, BlockEditorDataTypeDefinition> | null,
  mergedDocumentTypes?: Record<string, DocumentTypeDefinition> | null,
): string | null {
  const dt = getBlockEditorDataTypeForDocument(documentTypeAlias, mergedByDataTypeAlias, mergedDocumentTypes);
  if (!dt) return null;
  if (blockCount > dt.maxItems) {
    return `For mange blokker for data type «${dt.title}» (maks ${dt.maxItems}).`;
  }
  if (blockCount < dt.minItems) {
    return `For få blokker for data type «${dt.title}» (minst ${dt.minItems}).`;
  }
  return null;
}

export function canAddBlockForDataType(
  documentTypeAlias: string | null | undefined,
  currentCount: number,
  mergedByDataTypeAlias?: Record<string, BlockEditorDataTypeDefinition> | null,
  mergedDocumentTypes?: Record<string, DocumentTypeDefinition> | null,
): boolean {
  const dt = getBlockEditorDataTypeForDocument(documentTypeAlias, mergedByDataTypeAlias, mergedDocumentTypes);
  if (!dt) return true;
  return currentCount < dt.maxItems;
}

/** Minimal shape for grouping — matches `BackofficeBlockDefinition` fields used here. */
export type BlockLibraryEntryLike = { type: string; label: string; libraryGroup: string };

/**
 * Groups library cards: Data Type `groups` order when defined; else fallback to entry `libraryGroup` (block entry metadata).
 */
export function groupBlockLibraryEntriesByDataType(
  entries: BlockLibraryEntryLike[],
  dataType: BlockEditorDataTypeDefinition | null,
): { group: string; items: BlockLibraryEntryLike[] }[] {
  const allow =
    dataType && dataType.allowedBlockAliases.length
      ? new Set<string>([...dataType.allowedBlockAliases])
      : null;
  const scoped = allow ? entries.filter((e) => allow.has(e.type)) : entries;

  if (!dataType?.groups?.length) {
    const map = new Map<string, BlockLibraryEntryLike[]>();
    for (const e of scoped) {
      const g = e.libraryGroup?.trim() || "Annet";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(e);
    }
    const keys = [...map.keys()].sort((a, b) => a.localeCompare(b, "nb"));
    return keys.map((group) => ({
      group,
      items: (map.get(group) ?? []).slice().sort((a, b) => a.label.localeCompare(b.label, "nb")),
    }));
  }
  const used = new Set<string>();
  const out: { group: string; items: BlockLibraryEntryLike[] }[] = [];
  for (const g of dataType.groups) {
    const items = g.blockAliases
      .map((alias) => scoped.find((e) => e.type === alias))
      .filter((e): e is BlockLibraryEntryLike => Boolean(e));
    for (const e of items) used.add(e.type);
    if (items.length) {
      out.push({
        group: g.title,
        items: items.slice().sort((a, b) => a.label.localeCompare(b.label, "nb")),
      });
    }
  }
  const rest = scoped.filter((e) => !used.has(e.type)).sort((a, b) => a.label.localeCompare(b.label, "nb"));
  if (rest.length) {
    out.push({ group: "Andre tillatte", items: rest });
  }
  return out;
}
