import { describe, expect, it } from "vitest";
import { getMergedDocumentTypeDefinitionsCoreRecord } from "@/lib/cms/schema/documentTypeDefinitionMerged.server";
import { resolveAllowedChildAliasesForParent, resolveCreateDialogOptions } from "@/lib/cms/contentCreateFlow";

describe("DocumentTypeCreateDialogParity (U97E)", () => {
  it("create-dialog options følger allowedChildTypes fra kanonisk merged document types", () => {
    const merged = getMergedDocumentTypeDefinitionsCoreRecord();
    const allowedAliases = resolveAllowedChildAliasesForParent("page", merged);
    expect(allowedAliases).toContain("compact_page");
    const options = resolveCreateDialogOptions(allowedAliases, merged);
    expect(options.some((o) => o.alias === "compact_page")).toBe(true);
    expect(options.some((o) => o.alias === "page")).toBe(false);
  });
});
