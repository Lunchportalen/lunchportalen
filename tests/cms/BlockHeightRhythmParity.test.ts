/**
 * U78: Rammene skal ha ulik vertikal tilstedeværelse (ikke samme stripehøyde for alle).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function frameFile(name: string): string {
  return fs.readFileSync(path.join(root, "components", "cms", "blockCanvas", "frames", name), "utf8");
}

describe("BlockHeightRhythmParity (U78)", () => {
  it("editorielle rammer har distinkte min-h på ytre skall", () => {
    const hero = frameFile("HeroCanvasFrame.tsx").match(/min-h-\[[^\]]+]/)?.[0];
    const cards = frameFile("CardsCanvasFrame.tsx").match(/min-h-\[[^\]]+]/)?.[0];
    const steps = frameFile("StepsCanvasFrame.tsx").match(/min-h-\[[^\]]+]/)?.[0];
    const pricing = frameFile("PricingCanvasFrame.tsx").match(/min-h-\[[^\]]+]/)?.[0];
    const cta = frameFile("CtaCanvasFrame.tsx").match(/min-h-\[[^\]]+]/)?.[0];
    const related = frameFile("RelatedCanvasFrame.tsx").match(/min-h-\[[^\]]+]/)?.[0];
    const grid = frameFile("GridCanvasFrame.tsx").match(/min-h-\[[^\]]+]/)?.[0];
    const set = new Set([hero, cards, steps, pricing, cta, related, grid]);
    expect(set.size).toBe(7);
    expect([hero, cards, steps, pricing, cta, related, grid].every(Boolean)).toBe(true);
  });

  it("kollapset panel min-h varierer mellom rammer (fysisk rytme)", () => {
    const joined = fs
      .readdirSync(path.join(root, "components", "cms", "blockCanvas", "frames"))
      .filter((f) => f.endsWith("CanvasFrame.tsx") && f !== "DefaultCanvasFrame.tsx")
      .map((f) => frameFile(f))
      .join("\n");
    const mins = [...joined.matchAll(/min-h-\[(\d+)px]/g)].map((m) => Number(m[1]));
    expect(mins.length).toBeGreaterThanOrEqual(14);
    expect(new Set(mins).size).toBeGreaterThanOrEqual(5);
  });
});
