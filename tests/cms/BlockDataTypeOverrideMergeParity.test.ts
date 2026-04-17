import { describe, expect, it } from "vitest";
import { getBlockEditorDataType } from "@/lib/cms/blocks/blockEditorDataTypes";
import {
  mergeAllBlockEditorDataTypesWithOverrides,
  mergeBlockEditorDataTypeDefinition,
  type BlockEditorDataTypeOverridesFile,
} from "@/lib/cms/blocks/blockEditorDataTypeMerge";

describe("U95 BlockDataTypeOverrideMergeParity", () => {
  it("mergeBlockEditorDataTypeDefinition bruker override når satt", () => {
    const baseline = getBlockEditorDataType("compact_page_blocks");
    expect(baseline).toBeTruthy();
    const merged = mergeBlockEditorDataTypeDefinition(baseline!, {
      createButtonLabel: "UI-label fra admin",
      maxItems: 2,
    });
    expect(merged.createButtonLabel).toBe("UI-label fra admin");
    expect(merged.maxItems).toBe(2);
    expect(merged.alias).toBe(baseline!.alias);
  });

  it("mergeAllBlockEditorDataTypesWithOverrides beholder baseline for uoverstyrte alias", () => {
    const file: BlockEditorDataTypeOverridesFile = {
      version: 1,
      byAlias: {
        compact_page_blocks: { createButtonLabel: "Kun denne" },
      },
    };
    const all = mergeAllBlockEditorDataTypesWithOverrides(file);
    expect(all.compact_page_blocks.createButtonLabel).toBe("Kun denne");
    const micro = getBlockEditorDataType("page_micro_blocks");
    expect(all.page_micro_blocks.createButtonLabel).toBe(micro!.createButtonLabel);
  });
});
