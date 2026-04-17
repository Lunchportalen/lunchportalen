import { describe, expect, it } from "vitest";
import {
  getBaselineCompositionDefinition,
  listBaselineCompositionDefinitions,
  listCompositionAliases,
} from "@/lib/cms/schema/compositionDefinitions";

describe("CompositionDefinitionParity (U97B)", () => {
  it("har kanoniske composition-definisjoner", () => {
    const aliases = listCompositionAliases();
    expect(aliases).toContain("seo_metadata");
    expect(aliases).toContain("page_intro");
    expect(listBaselineCompositionDefinitions().length).toBeGreaterThanOrEqual(2);
  });

  it("hver composition har grupper/properties med dataTypeAlias", () => {
    for (const alias of listCompositionAliases()) {
      const c = getBaselineCompositionDefinition(alias);
      expect(c, alias).toBeDefined();
      expect(c!.groups.length).toBeGreaterThan(0);
      expect(c!.properties.length).toBeGreaterThan(0);
      for (const p of c!.properties) {
        expect(p.dataTypeAlias.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
