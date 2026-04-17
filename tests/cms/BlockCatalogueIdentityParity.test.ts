import { describe, expect, it } from "vitest";
import { CORE_CMS_BLOCK_DEFINITIONS } from "@/lib/cms/blocks/registry";

/** U76: blokkatalogen forklarer hvorfor / når / hvordan den skiller seg fra naboer. */
describe("BlockCatalogueIdentityParity (U76)", () => {
  const byType = Object.fromEntries(CORE_CMS_BLOCK_DEFINITIONS.map((d) => [d.type, d]));

  it("hver kjerneblokk har meningsfull beskrivelse (ikke bare gjentatt label)", () => {
    for (const d of CORE_CMS_BLOCK_DEFINITIONS) {
      expect(d.description.trim().length).toBeGreaterThan(24);
      expect(d.description.trim().toLowerCase()).not.toBe(d.label.trim().toLowerCase());
    }
  });

  it("tre hero-varianter er eksplisitt differensiert i tekst", () => {
    const h = byType.hero?.description ?? "";
    const hf = byType.hero_full?.description ?? "";
    const hb = byType.hero_bleed?.description ?? "";
    expect(h.toLowerCase()).toMatch(/standard|innholdsbredden|primær/);
    expect(hf.toLowerCase()).toMatch(/gradient|full bredde/);
    expect(hb.toLowerCase()).toMatch(/kant|overlay|to cta|variant/);
    expect(new Set([h, hf, hb]).size).toBe(3);
  });

  it("kort-seksjon vs lokasjonsrutenett vs steg er ikke forvekslet i katalogen", () => {
    expect(byType.cards?.description.toLowerCase()).toMatch(/kort|verdi|hero/);
    expect(byType.grid?.description.toLowerCase()).toMatch(/rutenett|celle|meta|kort-seksjon/);
    expect(byType.zigzag?.description.toLowerCase()).toMatch(/steg|faq|flyt/);
  });

  it("ingen engelske «leketøy»-etiketter for kjernetyper (Rich text / Image / Divider / Form)", () => {
    const labels = CORE_CMS_BLOCK_DEFINITIONS.map((d) => d.label);
    expect(labels.some((l) => /^Rich text$/i.test(l))).toBe(false);
    expect(labels.some((l) => /^Image$/i.test(l))).toBe(false);
    expect(labels.some((l) => /^Divider$/i.test(l))).toBe(false);
    expect(labels.some((l) => /^Form$/i.test(l))).toBe(false);
  });
});
