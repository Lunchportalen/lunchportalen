import { describe, expect, it } from "vitest";
import { mergeAllCompositionsWithOverrides } from "@/lib/cms/schema/compositionDefinitionMerge";
import { getBaselineCompositionDefinition } from "@/lib/cms/schema/compositionDefinitions";

describe("CompositionRuntimeEffectParity (U97B)", () => {
  it("composition override endrer label/description i runtime-merge", () => {
    const merged = mergeAllCompositionsWithOverrides({
      version: 1,
      byAlias: {
        seo_metadata: {
          title: "SEO metadata (runtime test)",
          properties: {
            seo_title: {
              title: "SEO tittel (runtime test)",
              description: "Oppdatert fra runtime override",
            },
          },
        },
      },
    });
    expect(merged.seo_metadata.title).toBe("SEO metadata (runtime test)");
    const p = merged.seo_metadata.properties.find((x) => x.alias === "seo_title");
    expect(p?.title).toBe("SEO tittel (runtime test)");
  });

  it("baseline composition er fortsatt kilde for allowedDocumentTypeAliases", () => {
    const baseline = getBaselineCompositionDefinition("seo_metadata");
    expect(baseline?.allowedDocumentTypeAliases).toContain("page");
  });
});
