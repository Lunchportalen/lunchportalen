import { describe, expect, it } from "vitest";
import { getMergedDocumentTypeDefinitionsCoreRecord } from "@/lib/cms/schema/documentTypeDefinitionMerged.server";
import { resolveRootCreateAliases } from "@/lib/cms/contentCreateFlow";

describe("AllowAtRootCreateFlowParity (U97E)", () => {
  it("root create aliases følger allowAtRoot", () => {
    const merged = getMergedDocumentTypeDefinitionsCoreRecord();
    const rootAliases = resolveRootCreateAliases(merged);
    expect(rootAliases).toContain("page");
    expect(rootAliases).toContain("compact_page");
    expect(rootAliases).not.toContain("micro_landing");
  });
});
