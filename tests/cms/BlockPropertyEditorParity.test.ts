/**
 * U84: Nøkkelblokker har egne property editor-komponenter (ikke én monolitt).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const peDir = path.join(
  root,
  "app",
  "(backoffice)",
  "backoffice",
  "content",
  "_components",
  "blockPropertyEditors",
);

describe("BlockPropertyEditorParity (U84)", () => {
  it("nøkkelblokker har dedikerte property editor-filer med data-lp-property-editor-root", () => {
    const required: { file: string; rootAttr: string }[] = [
      { file: "HeroPropertyEditor.tsx", rootAttr: 'data-lp-property-editor-root="hero"' },
      { file: "HeroFullPropertyEditor.tsx", rootAttr: 'data-lp-property-editor-root="hero_full"' },
      { file: "HeroBleedPropertyEditor.tsx", rootAttr: 'data-lp-property-editor-root="hero_bleed"' },
      { file: "CardsPropertyEditor.tsx", rootAttr: 'data-lp-property-editor-root="cards"' },
      { file: "StepsPropertyEditor.tsx", rootAttr: 'data-lp-property-editor-root="zigzag"' },
      { file: "PricingPropertyEditor.tsx", rootAttr: 'data-lp-property-editor-root="pricing"' },
      { file: "GridPropertyEditor.tsx", rootAttr: 'data-lp-property-editor-root="grid"' },
      { file: "CtaPropertyEditor.tsx", rootAttr: 'data-lp-property-editor-root="cta"' },
      { file: "RelatedLinksPropertyEditor.tsx", rootAttr: 'data-lp-property-editor-root="relatedLinks"' },
    ];
    for (const { file, rootAttr } of required) {
      const src = fs.readFileSync(path.join(peDir, file), "utf8");
      expect(src).toContain("export function ");
      expect(src).toContain(rootAttr);
      expect(src).toContain("useBlockDatasetAdapter");
    }
  });

  it("router kobler alle kjerne-typer til egne editor-komponenter", () => {
    const router = fs.readFileSync(path.join(peDir, "BlockPropertyEditorRouter.tsx"), "utf8");
    expect(router).toContain("<HeroPropertyEditor");
    expect(router).toContain("<CardsPropertyEditor");
    expect(router).toContain("<StepsPropertyEditor");
    expect(router).toContain("<PricingPropertyEditor");
    expect(router).toContain("<GridPropertyEditor");
    expect(router).toContain("<CtaPropertyEditor");
    expect(router).toContain("<RelatedLinksPropertyEditor");
  });
});
