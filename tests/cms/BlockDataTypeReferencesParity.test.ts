import { describe, expect, it } from "vitest";
import {
  blockEditorDataTypeReferencesByAlias,
  listReferencesForBlockEditorDataTypeAlias,
} from "@/lib/cms/blocks/blockEditorDataTypeReferences";

describe("U95 BlockDataTypeReferencesParity", () => {
  it("compact_page_blocks refererer til compact_page dokumenttypen", () => {
    const refs = listReferencesForBlockEditorDataTypeAlias("compact_page_blocks");
    expect(refs.some((r) => r.documentTypeAlias === "compact_page")).toBe(true);
    expect(refs.every((r) => r.propertyKey === "body.blocks")).toBe(true);
  });

  it("blockEditorDataTypeReferencesByAlias er konsistent per alias", () => {
    const by = blockEditorDataTypeReferencesByAlias();
    expect(by.page_marketing_blocks?.length).toBeGreaterThan(0);
    expect(by.page_micro_blocks?.map((r) => r.documentTypeAlias)).toContain("micro_landing");
  });
});
