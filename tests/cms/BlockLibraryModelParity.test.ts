import { describe, expect, test } from "vitest";
import { KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS } from "@/lib/cms/blocks/blockEntryContract";
import {
  getBlockTypeDefinition,
  PROPERTY_EDITOR_COMPONENT_BY_ALIAS,
  CANVAS_VIEW_COMPONENT_BY_ALIAS,
} from "@/lib/cms/blocks/blockTypeDefinitions";

/** U91: bibliotek-metadata og editor/view-routing kommer fra samme definisjon. */
describe("BlockLibraryModelParity (U91)", () => {
  test("hver nøkkelblokk har full library-katalog + routing + defaults + validation i én definisjon", () => {
    for (const alias of KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS) {
      const d = getBlockTypeDefinition(alias);
      expect(d).toBeTruthy();
      expect(d!.title.trim().length).toBeGreaterThan(2);
      expect(d!.whenToUse.trim().length).toBeGreaterThan(10);
      expect(Object.keys(d!.differsFrom).length).toBeGreaterThan(0);
      expect(d!.libraryGroup.trim().length).toBeGreaterThan(1);
      expect(PROPERTY_EDITOR_COMPONENT_BY_ALIAS[alias]).toBe(d!.propertyEditorComponent);
      expect(CANVAS_VIEW_COMPONENT_BY_ALIAS[alias]).toBe(d!.canvasViewComponent);
      expect(typeof d!.defaultsFactory()).toBe("object");
      expect(Array.isArray(d!.validationRules)).toBe(true);
      expect(d!.contentSections.length).toBeGreaterThan(0);
    }
  });
});
