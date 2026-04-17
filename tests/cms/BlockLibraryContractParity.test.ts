/**
 * U87: Block library = katalog — identitet og when-to-use fra kanonisk definisjon.
 */
import { describe, expect, it } from "vitest";
import { getBackofficeBlockCatalog } from "@/lib/cms/backofficeBlockCatalog";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";

describe("BlockLibraryContractParity (U87)", () => {
  const key = [
    "hero",
    "hero_full",
    "hero_bleed",
    "cards",
    "grid",
    "cta",
    "banner",
    "zigzag",
    "relatedLinks",
    "pricing",
  ] as const;

  it("katalog-oppføringer leser whenToUse og differsFrom fra kanon (ingen tom identitet)", () => {
    const catalog = getBackofficeBlockCatalog();
    for (const type of key) {
      const entry = catalog.find((c) => c.type === type);
      const canon = getBlockTypeDefinition(type);
      expect(entry, type).toBeTruthy();
      expect(canon, type).toBeTruthy();
      expect(entry!.whenToUse).toBe(canon!.whenToUse);
      expect(entry!.whenToUse.length).toBeGreaterThanOrEqual(40);
      expect(entry!.differsFrom).toEqual(canon!.differsFrom);
    }
  });

  it("nære blokker har ikke-tom differsFrom mot minst én nabo der forventet", () => {
    expect(Object.keys(getBlockTypeDefinition("hero")!.differsFrom).length).toBeGreaterThanOrEqual(2);
    expect(getBlockTypeDefinition("cards")!.differsFrom.grid).toBeTruthy();
    expect(getBlockTypeDefinition("grid")!.differsFrom.cards).toBeTruthy();
    expect(getBlockTypeDefinition("cta")!.differsFrom.banner).toBeTruthy();
    expect(getBlockTypeDefinition("banner")!.differsFrom.cta).toBeTruthy();
    expect(getBlockTypeDefinition("relatedLinks")!.differsFrom.zigzag).toBeTruthy();
  });
});
