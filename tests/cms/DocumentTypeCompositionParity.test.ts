import { describe, expect, it } from "vitest";
import { expandDocumentTypeWithCompositions } from "@/lib/cms/schema/documentTypeCompositionExpand";
import { getMergedCompositionDefinitionsRecord } from "@/lib/cms/schema/compositionDefinitionMerged.server";
import { getBaselineDocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";

describe("DocumentTypeCompositionParity (U97B)", () => {
  it("document type refererer gyldige composition aliases", () => {
    const page = getBaselineDocumentTypeDefinition("page");
    const comps = getMergedCompositionDefinitionsRecord();
    expect(page).toBeDefined();
    for (const alias of page!.compositionAliases) {
      expect(comps[alias]).toBeDefined();
    }
  });

  it("composition injiserer shared group/property i effektiv document type", () => {
    const page = getBaselineDocumentTypeDefinition("page");
    const comps = getMergedCompositionDefinitionsRecord();
    const expanded = expandDocumentTypeWithCompositions(page!, comps);
    expect(expanded.groups.some((g) => g.id === "seo")).toBe(true);
    expect(expanded.properties.some((p) => p.alias === "seo_title")).toBe(true);
  });
});
