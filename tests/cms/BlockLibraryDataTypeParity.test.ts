/**
 * U84: Block library (katalog) har tydelig identitet for nøkkeltyper — beskrivelser fra CMS-definisjoner.
 */
import { describe, expect, it } from "vitest";
import { CORE_CMS_BLOCK_DEFINITIONS } from "@/lib/cms/blocks/registry";

describe("BlockLibraryDataTypeParity (U84)", () => {
  const minLen = 48;

  it("nøkkelblokker har meningsfull beskrivelse (data-type-nivå)", () => {
    const keys = [
      "hero",
      "hero_full",
      "hero_bleed",
      "cards",
      "grid",
      "cta",
      "banner",
      "zigzag",
      "relatedLinks",
    ] as const;
    for (const type of keys) {
      const def = CORE_CMS_BLOCK_DEFINITIONS.find((b) => b.type === type);
      expect(def, type).toBeTruthy();
      expect(def!.description.length).toBeGreaterThanOrEqual(minLen);
      expect(def!.description.toLowerCase()).not.toBe(def!.label.toLowerCase());
    }
  });

  it("CTA vs banner er eksplisitt differensiert i tekst", () => {
    const cta = CORE_CMS_BLOCK_DEFINITIONS.find((b) => b.type === "cta")!;
    const banner = CORE_CMS_BLOCK_DEFINITIONS.find((b) => b.type === "banner")!;
    expect(cta.description.toLowerCase()).toMatch(/banner|strip/);
    expect(banner.description.toLowerCase()).toMatch(/cta|handlingsseksjon/);
  });

  it("cards vs grid er eksplisitt differensiert", () => {
    const cards = CORE_CMS_BLOCK_DEFINITIONS.find((b) => b.type === "cards")!;
    const grid = CORE_CMS_BLOCK_DEFINITIONS.find((b) => b.type === "grid")!;
    expect(cards.description.toLowerCase()).toMatch(/lokasjon|rutenett|ikke/);
    expect(grid.description.toLowerCase()).toMatch(/kort|verdi|ikke/);
  });
});
