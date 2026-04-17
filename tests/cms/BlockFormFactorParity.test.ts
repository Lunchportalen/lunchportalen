/**
 * U78: Ulik komposisjon / layout-signaler — ikke bare samme flex-rad med ulikt innhold.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("BlockFormFactorParity (U78)", () => {
  it("preview-komponenter bruker forskjellige layout-primitiver (grid / kolonne / akcent)", () => {
    const dir = path.join(root, "components", "cms", "blockCanvas");
    const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");
    const hero = read("HeroCanvasPreview.tsx");
    const cards = read("CardsCanvasPreview.tsx");
    const steps = read("StepsCanvasPreview.tsx");
    const pricing = read("PricingCanvasPreview.tsx");
    const cta = read("CtaCanvasPreview.tsx");
    const related = read("RelatedLinksCanvasPreview.tsx");
    const grid = read("GridCanvasPreview.tsx");

    expect(hero).toMatch(/sm:flex-row/);
    expect(cards).toMatch(/flex-col gap-2 sm:flex-row/);
    expect(pricing).toContain("sm:grid-cols-3");
    expect(cta).toMatch(/sm:flex-row/);
    expect(related).toContain("<ul");
    expect(grid).toContain("gridTemplateColumns");
    expect(steps).toContain("data-lp-preview-steps-mode");
    expect(steps).toMatch(/isFaq \?/);
  });

  it("canvas-rammer har ikke identisk ytre signatur (farge/aksent skiller)", () => {
    const framesDir = path.join(root, "components", "cms", "blockCanvas", "frames");
    const files = [
      "HeroCanvasFrame.tsx",
      "CardsCanvasFrame.tsx",
      "StepsCanvasFrame.tsx",
      "PricingCanvasFrame.tsx",
      "CtaCanvasFrame.tsx",
      "RelatedCanvasFrame.tsx",
      "GridCanvasFrame.tsx",
    ];
    const bodies = files.map((f) => fs.readFileSync(path.join(framesDir, f), "utf8"));
    const fromPink = bodies.filter((s) => s.includes("pink-")).length;
    const fromAmber = bodies.filter((s) => s.includes("amber-")).length;
    const fromIndigo = bodies.filter((s) => s.includes("indigo-")).length;
    const fromSky = bodies.filter((s) => s.includes("sky-")).length;
    const linearGrad = bodies.filter((s) => s.includes("linear-gradient")).length;
    expect(fromPink).toBeGreaterThanOrEqual(1);
    expect(fromAmber).toBeGreaterThanOrEqual(1);
    expect(fromIndigo).toBeGreaterThanOrEqual(1);
    expect(fromSky).toBeGreaterThanOrEqual(1);
    expect(linearGrad).toBeGreaterThanOrEqual(1);
  });
});
