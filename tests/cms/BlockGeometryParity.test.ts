/**
 * U80B: Nøkkelblokker skal ikke dele samme layout-mønster (handle/actions/body) — kilde-sanity.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("BlockGeometryParity (U80B)", () => {
  it("syv distinkte data-lp-canvas-geometry verdier for nøkkelblokkene", () => {
    const dir = path.join(root, "components", "cms", "blockCanvas", "frames");
    const files = [
      "HeroCanvasFrame.tsx",
      "CardsCanvasFrame.tsx",
      "StepsCanvasFrame.tsx",
      "PricingCanvasFrame.tsx",
      "CtaCanvasFrame.tsx",
      "RelatedCanvasFrame.tsx",
      "GridCanvasFrame.tsx",
    ];
    const values = files.map((f) => {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      const m = src.match(/data-lp-canvas-geometry="([^"]+)"/);
      expect(m, f).toBeTruthy();
      return m![1];
    });
    expect(new Set(values).size).toBe(7);
  });

  it("layout-signaler er ikke alle identiske flex-rad-krom (forskjellige primitiver)", () => {
    const dir = path.join(root, "components", "cms", "blockCanvas", "frames");
    const hero = fs.readFileSync(path.join(dir, "HeroCanvasFrame.tsx"), "utf8");
    const cards = fs.readFileSync(path.join(dir, "CardsCanvasFrame.tsx"), "utf8");
    const steps = fs.readFileSync(path.join(dir, "StepsCanvasFrame.tsx"), "utf8");
    const pricing = fs.readFileSync(path.join(dir, "PricingCanvasFrame.tsx"), "utf8");
    const cta = fs.readFileSync(path.join(dir, "CtaCanvasFrame.tsx"), "utf8");
    const related = fs.readFileSync(path.join(dir, "RelatedCanvasFrame.tsx"), "utf8");
    const grid = fs.readFileSync(path.join(dir, "GridCanvasFrame.tsx"), "utf8");

    expect(hero).toMatch(/absolute (left|right)-2/);
    expect(cards).toContain("flex-row");
    expect(cards).toContain("Seksjon");
    expect(steps).toContain("data-lp-canvas-steps-rail");
    expect(pricing).toContain("data-lp-canvas-pricing-tier-backdrop");
    expect(pricing).toContain("grid-cols-3");
    expect(cta).toContain("data-lp-canvas-cta-primary-stub");
    expect(related).toContain("data-lp-canvas-related-list-head");
    expect(grid).toContain("grid-cols-4");
  });
});
