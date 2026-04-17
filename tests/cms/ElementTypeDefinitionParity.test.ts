/**
 * U96 — Element Type-lag er eksplisitt og separat fra Data Type (wrapper over block entries).
 */
import { describe, expect, it } from "vitest";
import { KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS } from "@/lib/cms/blocks/blockTypeDefinitions";
import {
  getElementTypeDefinition,
  listElementTypeDefinitions,
  U96_ELEMENT_TYPE_MARK,
} from "@/lib/cms/schema/elementTypeDefinitions";

describe("ElementTypeDefinitionParity (U96)", () => {
  it("element type-liste dekker alle block definitions med kontraktmarkør", () => {
    expect(U96_ELEMENT_TYPE_MARK).toBe("U96_ELEMENT_TYPE_LAYER");
    const all = listElementTypeDefinitions();
    expect(all.length).toBeGreaterThan(0);
    const byAlias = new Map(all.map((e) => [e.alias, e]));
    for (const alias of KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS) {
      const el = byAlias.get(alias);
      expect(el, alias).toBeDefined();
      expect(el!.propertyEditorComponent.trim().length).toBeGreaterThan(0);
      expect(el!.canvasViewComponent.trim().length).toBeGreaterThan(0);
      expect(el!.title.trim().length).toBeGreaterThan(0);
    }
  });

  it("getElementTypeDefinition matcher listElementTypeDefinitions", () => {
    for (const el of listElementTypeDefinitions()) {
      expect(getElementTypeDefinition(el.alias)?.alias).toBe(el.alias);
    }
  });
});
