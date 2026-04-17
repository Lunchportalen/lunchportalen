/**
 * U80B: Hver nøkkelblokk-frame eier egen struktur (ikke bare body-snippet via delt chrome).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const KEY_FRAMES = [
  "HeroCanvasFrame.tsx",
  "CardsCanvasFrame.tsx",
  "StepsCanvasFrame.tsx",
  "PricingCanvasFrame.tsx",
  "CtaCanvasFrame.tsx",
  "RelatedCanvasFrame.tsx",
  "GridCanvasFrame.tsx",
] as const;

describe("BlockFrameOwnershipParity (U80B)", () => {
  it("hver nøkkelramme har egen geometri-markør og full chrome (handle + toolbar + identitet)", () => {
    const dir = path.join(root, "components", "cms", "blockCanvas", "frames");
    const geometries: string[] = [];
    for (const f of KEY_FRAMES) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      expect(src).toContain("data-lp-canvas-frame=");
      expect(src).toContain("data-lp-canvas-geometry=");
      expect(src).toContain("BlockTypeIcon");
      expect(src).toContain("getBlockLabel");
      const m = src.match(/data-lp-canvas-geometry="([^"]+)"/);
      expect(m).toBeTruthy();
      geometries.push(m![1]);
    }
    expect(new Set(geometries).size).toBe(KEY_FRAMES.length);
  });

  it("DefaultCanvasFrame beholder eksplisitt BlockChromeRow (generisk blokk, ikke nøkkelfamilie)", () => {
    const src = fs.readFileSync(
      path.join(root, "components", "cms", "blockCanvas", "frames", "DefaultCanvasFrame.tsx"),
      "utf8",
    );
    expect(src).toContain("BlockChromeRow");
    expect(src).toContain("data-lp-canvas-geometry=");
  });
});
