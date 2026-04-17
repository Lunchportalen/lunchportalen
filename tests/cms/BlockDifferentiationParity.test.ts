/**
 * U87: Eksplisitt differensiering mellom overlappende blokker (tekst + differsFrom).
 */
import { describe, expect, it } from "vitest";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";

describe("BlockDifferentiationParity (U87)", () => {
  it("hero vs hero_full vs hero_bleed — tre tydelige roller", () => {
    const a = getBlockTypeDefinition("hero")!;
    const b = getBlockTypeDefinition("hero_full")!;
    const c = getBlockTypeDefinition("hero_bleed")!;
    expect(new Set([a.title, b.title, c.title]).size).toBe(3);
    expect(a.differsFrom.hero_full).toBeTruthy();
    expect(a.differsFrom.hero_bleed).toBeTruthy();
    expect(b.differsFrom.hero).toBeTruthy();
    expect(b.differsFrom.hero_bleed).toBeTruthy();
    expect(c.differsFrom.hero).toBeTruthy();
    expect(c.differsFrom.hero_full).toBeTruthy();
    expect(a.description.toLowerCase()).toMatch(/innholdsbredd|standard/);
    expect(c.description.toLowerCase()).toMatch(/kant|bleed|cta|to/);
  });

  it("cards vs grid — ikke synonyme", () => {
    const cards = getBlockTypeDefinition("cards")!;
    const grid = getBlockTypeDefinition("grid")!;
    expect(cards.description.toLowerCase()).toMatch(/lokasjon|rutenett|ikke/);
    expect(grid.description.toLowerCase()).toMatch(/kort|verdi|ikke/);
    expect(cards.differsFrom.grid).toBeTruthy();
    expect(grid.differsFrom.cards).toBeTruthy();
  });

  it("cta vs banner — strip vs seksjon", () => {
    const cta = getBlockTypeDefinition("cta")!;
    const banner = getBlockTypeDefinition("banner")!;
    expect(cta.description.toLowerCase()).toMatch(/banner|strip/);
    expect(banner.description.toLowerCase()).toMatch(/cta|handlingsseksjon/);
    expect(cta.differsFrom.banner).toBeTruthy();
    expect(banner.differsFrom.cta).toBeTruthy();
  });

  it("zigzag vs relatedLinks — prosess/FAQ vs kuratering", () => {
    const z = getBlockTypeDefinition("zigzag")!;
    const r = getBlockTypeDefinition("relatedLinks")!;
    expect(z.differsFrom.relatedLinks).toBeTruthy();
    expect(r.differsFrom.zigzag).toBeTruthy();
    expect(r.whenToUse.toLowerCase()).toMatch(/kurat|relaterte/);
    expect(r.description.toLowerCase()).toMatch(/kurat|ikke.*lenk/);
  });
});
