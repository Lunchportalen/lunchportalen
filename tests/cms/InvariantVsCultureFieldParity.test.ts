import { describe, expect, it } from "vitest";
import { getBaselineDocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import { listInvariantPropertyAliases } from "@/lib/cms/contentNodeEnvelope";

describe("InvariantVsCultureFieldParity", () => {
  it("invariant aliases are a strict subset of properties", () => {
    const doc = getBaselineDocumentTypeDefinition("page")!;
    const inv = listInvariantPropertyAliases(doc);
    expect(inv).toContain("structure_key");
    const all = new Set(doc.properties.map((p) => p.alias));
    for (const a of inv) {
      expect(all.has(a)).toBe(true);
    }
  });
});
