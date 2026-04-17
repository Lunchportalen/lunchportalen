import { describe, expect, it } from "vitest";
import {
  canAddBlockForDataType,
  getBlockEditorDataType,
  getBlockEditorDataTypeForDocument,
} from "@/lib/cms/blocks/blockEditorDataTypes";
import { mergeBlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypeMerge";

describe("U95 BlockDataTypeRuntimeEffectParity", () => {
  it("merged map endrer effektiv createButtonLabel / cap for dokumenttype", () => {
    const baseDt = getBlockEditorDataType("compact_page_blocks");
    expect(baseDt).toBeTruthy();
    const mergedMap = {
      compact_page_blocks: mergeBlockEditorDataTypeDefinition(baseDt!, {
        createButtonLabel: "Plukk blokk (test)",
        maxItems: 1,
      }),
    };
    const dt = getBlockEditorDataTypeForDocument("compact_page", mergedMap);
    expect(dt?.createButtonLabel).toBe("Plukk blokk (test)");
    expect(canAddBlockForDataType("compact_page", 1, mergedMap)).toBe(false);
    expect(canAddBlockForDataType("compact_page", 0, mergedMap)).toBe(true);
  });
});
