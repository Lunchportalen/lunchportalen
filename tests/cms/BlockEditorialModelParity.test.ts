import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Fanger opp «flate demo-blokker» ved at nøkkeltyper må deklarere samlinger / sekundære felt i editorBlockTypes.
 */
describe("BlockEditorialModelParity (U74)", () => {
  const root = process.cwd();
  const typesPath = path.join(
    root,
    "app",
    "(backoffice)",
    "backoffice",
    "content",
    "_components",
    "editorBlockTypes.ts",
  );
  const src = fs.readFileSync(typesPath, "utf8");

  it("cards: samling + presentasjon + per-kort lenkefelt", () => {
    expect(src).toContain("items: CardRow[]");
    expect(src).toContain("presentation?:");
    expect(src).toContain("linkLabel?:");
  });

  it("zigzag: steg-samling + intro + presentasjon", () => {
    expect(src).toContain("steps: ZigzagStep[]");
    expect(src).toContain("intro?:");
    expect(src).toContain('presentation?: "process" | "faq"');
  });

  it("pricing: plan-rader med tagline, badge, period, CTA", () => {
    expect(src).toContain("plans: PricingPlanRow[]");
    expect(src).toContain("tagline?:");
    expect(src).toContain("ctaLabel?:");
  });

  it("cta: sekundærknapp + eyebrow", () => {
    expect(src).toContain("secondaryButtonLabel?:");
    expect(src).toContain("eyebrow?:");
  });

  it("grid: lokasjonsfelt (undertittel, meta)", () => {
    expect(src).toContain("metaLine?:");
    expect(src).toContain("intro?:");
  });
});
