import { describe, expect, it } from "vitest";
import { getMergedDocumentTypeDefinitionsRecord } from "@/lib/cms/schema/documentTypeDefinitionMerged.server";
import { getDocType } from "@/lib/cms/contentDocumentTypes";

describe("DocumentTypeEditorEffectRuntimeParity (U97E)", () => {
  it("editor kontrakt leser document type fra merged source via getDocType-kompat", () => {
    const merged = getMergedDocumentTypeDefinitionsRecord();
    const compact = getDocType("compact_page", merged);
    expect(compact).toBeTruthy();
    expect(compact?.allowedChildTypes).toContain("micro_landing");
    expect(compact?.allowedChildren).toEqual(compact?.allowedChildTypes);
    expect(compact?.defaultTemplate).toBeTruthy();
  });
});
