import { describe, expect, it } from "vitest";
import { getMergedDocumentTypeDefinitionsCoreRecord } from "@/lib/cms/schema/documentTypeDefinitionMerged.server";
import { resolveAllowedChildAliasesForParent } from "@/lib/cms/contentCreateFlow";

describe("AllowedChildTypesCreateFlowParity (U97E)", () => {
  it("child create følger allowedChildTypes for compact_page", () => {
    const merged = getMergedDocumentTypeDefinitionsCoreRecord();
    const childAliases = resolveAllowedChildAliasesForParent("compact_page", merged);
    expect(childAliases).toEqual(["micro_landing"]);
    expect(childAliases).not.toContain("page");
  });
});
