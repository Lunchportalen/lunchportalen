/**
 * U96 — Block editor følger merged Data Type → tillatte element-alias.
 */
import { describe, expect, it } from "vitest";
import {
  getAllowedElementTypeAliasesForDataType,
  getBlockEditorDataTypeForDocument,
  resolveAllowedBlockAliasesForDocument,
} from "@/lib/cms/blocks/blockEditorDataTypes";
import { mergeAllBlockEditorDataTypesWithOverrides } from "@/lib/cms/blocks/blockEditorDataTypeMerge";
import { mergeAllDocumentTypesWithOverrides } from "@/lib/cms/schema/documentTypeDefinitionMerge";
import { getElementTypeDefinition } from "@/lib/cms/schema/elementTypeDefinitions";

describe("ElementTypeRuntimeEffectParity (U96)", () => {
  it("merged data type endrer allowlist (element-alias) uavhengig av document type", () => {
    const mergedDt = mergeAllBlockEditorDataTypesWithOverrides({
      version: 1,
      byAlias: {
        compact_page_blocks: {
          allowedBlockAliases: ["hero", "cta"],
        },
      },
    });
    const row = mergedDt.compact_page_blocks;
    expect([...getAllowedElementTypeAliasesForDataType(row)].sort()).toEqual(["cta", "hero"].sort());
    for (const a of row.allowedBlockAliases) {
      expect(getElementTypeDefinition(a), a).toBeDefined();
    }
  });

  it("document → data type → allowlist-kjede bruker begge merge-lag", () => {
    const mergedDocs = mergeAllDocumentTypesWithOverrides({
      version: 1,
      byAlias: {
        compact_page: { properties: { body: { dataTypeAlias: "compact_page_blocks" } } },
      },
    });
    const mergedDt = mergeAllBlockEditorDataTypesWithOverrides({
      version: 1,
      byAlias: {
        compact_page_blocks: { allowedBlockAliases: ["hero", "richText", "cards"] },
      },
    });
    const resolved = getBlockEditorDataTypeForDocument("compact_page", mergedDt, mergedDocs);
    expect(resolved?.alias).toBe("compact_page_blocks");
    const allow = resolveAllowedBlockAliasesForDocument("compact_page", mergedDt, mergedDocs);
    expect(allow?.sort()).toEqual(["cards", "hero", "richText"].sort());
  });
});
