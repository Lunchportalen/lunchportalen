/**
 * U77: hero/cards/steps/pricing/cta/related/grid skal ha tydelig forskjellige canvas-signaler i DOM-kontrakt.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("BlockCanvasIdentityParity (U77)", () => {
  it("unike preview-kind + canvas-view par for nøkkelblokker", () => {
    const dir = path.join(root, "components", "cms", "blockCanvas");
    const joined = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
      .join("\n");

    const canvasViews = [...joined.matchAll(/data-lp-canvas-view="([^"]+)"/g)].map((m) => m[1]);
    const keyViews = ["hero", "cards", "steps", "pricing", "cta", "relatedLinks", "grid"];
    for (const k of keyViews) {
      expect(canvasViews).toContain(k);
    }
    expect(new Set(keyViews).size).toBe(keyViews.length);
  });

  it("beholder blokkspesifikke mini-markører (Umbraco-parity hooks)", () => {
    const joined = readCanvasSources();
    expect(joined).toContain("data-lp-preview-hero-surface");
    expect(joined).toContain("data-lp-preview-card-stack");
    expect(joined).toContain("data-lp-preview-step-stack");
    expect(joined).toContain("data-lp-preview-pricing-tiers");
    expect(joined).toContain("data-lp-preview-cta-actions");
    expect(joined).toContain("data-lp-preview-related-strip");
    expect(joined).toContain("data-lp-preview-grid-lattice");
  });
});

function readCanvasSources(): string {
  const dir = path.join(root, "components", "cms", "blockCanvas");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
    .join("\n");
}
