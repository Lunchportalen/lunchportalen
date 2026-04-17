import { describe, expect, it } from "vitest";
import { getDocType } from "@/lib/cms/contentDocumentTypes";
import { mergeAllDocumentTypesWithOverrides } from "@/lib/cms/schema/documentTypeDefinitionMerge";

describe("ContentTreeStructureRuntimeParity (U97B)", () => {
  it("getDocType eksponerer allowedChildTypes + kompat alias uten competing truth", () => {
    const doc = getDocType("page");
    expect(doc).toBeTruthy();
    expect(doc!.allowedChildTypes).toContain("compact_page");
    expect(doc!.allowedChildren).toEqual(doc!.allowedChildTypes);
  });

  it("runtime override på allowedChildTypes slår inn i create-policy modell", () => {
    const merged = mergeAllDocumentTypesWithOverrides({
      version: 1,
      byAlias: { compact_page: { allowedChildTypes: [] } },
    });
    expect(merged.compact_page.allowedChildTypes).toEqual([]);
  });
});
