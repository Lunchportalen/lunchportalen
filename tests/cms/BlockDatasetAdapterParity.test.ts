/**
 * U84: Valgt blokk redigeres via dataset-adapter mot kanonisk setBlockById (ingen parallell sannhet).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const adapterPath = path.join(
  root,
  "app",
  "(backoffice)",
  "backoffice",
  "content",
  "_components",
  "useBlockDatasetAdapter.ts",
);

describe("BlockDatasetAdapterParity (U84)", () => {
  it("adapter eksponerer commit + collection-hjelpere som wrapper setBlockById", () => {
    const src = fs.readFileSync(adapterPath, "utf8");
    expect(src).toContain("setBlockById");
    expect(src).toContain("commit");
    expect(src).toContain("updateCollectionItem");
    expect(src).toContain("addCollectionItem");
    expect(src).toContain("removeCollectionItem");
    expect(src).toContain("reorderCollectionItems");
    expect(src.toLowerCase()).toContain("ingen parallell");
    expect(src.toLowerCase()).not.toContain("usestate");
  });

  it("nøkkel-editorfiler bruker useBlockDatasetAdapter (ikke egen useState for blokkverdi)", () => {
    const peDir = path.join(
      root,
      "app",
      "(backoffice)",
      "backoffice",
      "content",
      "_components",
      "blockPropertyEditors",
    );
    const keyFiles = [
      "HeroPropertyEditor.tsx",
      "CardsPropertyEditor.tsx",
      "PricingPropertyEditor.tsx",
      "CtaPropertyEditor.tsx",
    ];
    for (const f of keyFiles) {
      const s = fs.readFileSync(path.join(peDir, f), "utf8");
      expect(s).toContain("useBlockDatasetAdapter");
      expect(s).not.toMatch(/useState\s*\(\s*block/);
    }
  });
});
