import { describe, expect, test } from "vitest";
import { KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS } from "@/lib/cms/blocks/blockEntryContract";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";

/** U91: nøkkelblokker skal ikke være én flat blob i defaults — content/settings/(structure) er eksplisitt. */
describe("BlockEntryModelParity (U91)", () => {
  for (const alias of KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS) {
    test(`${alias} defaultsFactory bruker contentData og settingsData`, () => {
      const def = getBlockTypeDefinition(alias);
      expect(def).toBeTruthy();
      const d = def!.defaultsFactory() as Record<string, unknown>;
      expect(d).toHaveProperty("contentData");
      expect(d).toHaveProperty("settingsData");
      expect(d.contentData).toBeTruthy();
      expect(typeof d.contentData).toBe("object");
      expect(d.settingsData).toBeTruthy();
      expect(typeof d.settingsData).toBe("object");
      const hasStructure = ["cards", "zigzag", "pricing", "grid", "cta", "relatedLinks"].includes(alias);
      if (hasStructure) {
        expect(d).toHaveProperty("structureData");
        expect(typeof d.structureData).toBe("object");
      }
    });
  }
});
