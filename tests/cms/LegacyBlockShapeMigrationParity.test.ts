import { describe, expect, test } from "vitest";
import { normalizeBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";
import {
  isCanonicalEntryRow,
  migrateLegacyFlatRowToEntryLayers,
  KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS,
} from "@/lib/cms/blocks/blockEntryContract";

describe("LegacyBlockShapeMigrationParity (U91)", () => {
  test("flate legacy-rader migreres til contentData/settingsData/structureData", () => {
    const legacyHero = {
      id: "l1",
      type: "hero",
      title: "Hei",
      subtitle: "Sub",
      imageId: "x",
      ctaLabel: "Go",
      ctaHref: "/go",
    };
    expect(isCanonicalEntryRow(legacyHero)).toBe(false);
    const migrated = migrateLegacyFlatRowToEntryLayers("hero", legacyHero);
    expect(migrated.contentData.title).toBe("Hei");
    expect(migrated.settingsData).toEqual({});

    const norm = normalizeBlock(legacyHero);
    expect(norm?.type).toBe("hero");
    if (norm?.type === "hero") {
      expect(norm.contentData.title).toBe("Hei");
      expect(norm.contentData.ctaLabel).toBe("Go");
    }
  });

  test("kanonisk entry-rad roundtrippes uten å miste lag", () => {
    const legacyCards = {
      id: "c1",
      type: "cards",
      title: "Kort",
      text: "Ingress",
      presentation: "plain",
      items: [{ title: "A", text: "B" }],
    };
    const norm = normalizeBlock(legacyCards);
    expect(norm?.type).toBe("cards");
    if (norm?.type === "cards") {
      expect(norm.contentData.title).toBe("Kort");
      expect(norm.structureData.items.length).toBe(1);
    }
  });

  test("alle nøkkel-alias støttes i migrateLegacyFlatRowToEntryLayers", () => {
    for (const alias of KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS) {
      const row = { type: alias, id: "m1" };
      const out = migrateLegacyFlatRowToEntryLayers(alias, row);
      expect(out.contentData).toBeTruthy();
      expect(out.settingsData).toBeTruthy();
    }
  });
});
