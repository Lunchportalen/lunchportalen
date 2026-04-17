/**
 * U94 — Document type → blockEditorDataTypeAlias → resolved Data Type for body.blocks.
 */
import { describe, expect, it } from "vitest";
import { documentTypes, getDocType } from "@/lib/cms/contentDocumentTypes";
import {
  getBlockEditorDataType,
  getBlockEditorDataTypeForDocument,
} from "@/lib/cms/blocks/blockEditorDataTypes";

describe("BlockPropertyBindingParity (U94)", () => {
  it("hver dokumenttype med body.blocks peker eksplisitt på en data type-alias", () => {
    for (const doc of documentTypes) {
      expect(doc.blockEditorDataTypeAlias?.trim().length).toBeGreaterThan(0);
      const dt = getBlockEditorDataType(doc.blockEditorDataTypeAlias!);
      expect(dt, doc.alias).toBeTruthy();
      expect(dt!.propertyKey).toBe("body.blocks");
    }
  });

  it("compact_page binder til compact_page_blocks (smalt spektrum)", () => {
    const doc = getDocType("compact_page")!;
    expect(doc.blockEditorDataTypeAlias).toBe("compact_page_blocks");
    const resolved = getBlockEditorDataTypeForDocument("compact_page");
    expect(resolved?.alias).toBe("compact_page_blocks");
    expect(resolved?.allowedBlockAliases).toContain("hero");
    expect(resolved?.allowedBlockAliases).not.toContain("pricing");
  });

  it("micro_landing binder til page_micro_blocks", () => {
    expect(getDocType("micro_landing")!.blockEditorDataTypeAlias).toBe("page_micro_blocks");
    expect(getBlockEditorDataTypeForDocument("micro_landing")?.alias).toBe("page_micro_blocks");
  });
});
