import { describe, expect, it } from "vitest";
import { expandDocumentTypeWithCompositions } from "@/lib/cms/schema/documentTypeCompositionExpand";
import { getBaselineDocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import { getBaselineCompositionDefinition } from "@/lib/cms/schema/compositionDefinitions";
import { getPropertyVariation } from "@/lib/cms/contentNodeEnvelope";

describe("DocumentTypeVariationBindingParity", () => {
  it("expanded page type binds composition culture properties", () => {
    const core = getBaselineDocumentTypeDefinition("page")!;
    const compSeo = getBaselineCompositionDefinition("seo_metadata")!;
    const compIntro = getBaselineCompositionDefinition("page_intro")!;
    const expanded = expandDocumentTypeWithCompositions(core, {
      seo_metadata: compSeo,
      page_intro: compIntro,
    });
    const intro = expanded.properties.find((p) => p.alias === "intro_kicker");
    expect(intro).toBeDefined();
    expect(getPropertyVariation(intro!)).toBe("culture");
  });
});
