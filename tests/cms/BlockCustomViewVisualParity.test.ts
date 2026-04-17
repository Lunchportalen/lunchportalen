/**
 * U77: nøkkelblokker skal rendres med egne canvas custom views (kilde-signaler).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readCanvasSources(): string {
  const collapsed = path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "BlockCollapsedPreview.tsx");
  const dir = path.join(root, "components", "cms", "blockCanvas");
  const parts = [fs.readFileSync(collapsed, "utf8")];
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".tsx")) parts.push(fs.readFileSync(path.join(dir, f), "utf8"));
  }
  return parts.join("\n");
}

describe("BlockCustomViewVisualParity (U77)", () => {
  const src = readCanvasSources();

  it("har eksplisitte canvas-view markører per nøkkelblokk", () => {
    expect(src).toContain('data-lp-canvas-view="hero"');
    expect(src).toContain('data-lp-canvas-view="cards"');
    expect(src).toContain('data-lp-canvas-view="steps"');
    expect(src).toContain('data-lp-canvas-view="pricing"');
    expect(src).toContain('data-lp-canvas-view="cta"');
    expect(src).toContain('data-lp-canvas-view="relatedLinks"');
    expect(src).toContain('data-lp-canvas-view="grid"');
  });

  it("nøkkelkomponenter er egne filer (ikke alt i én generisk mal)", () => {
    for (const name of [
      "HeroCanvasPreview",
      "CardsCanvasPreview",
      "StepsCanvasPreview",
      "PricingCanvasPreview",
      "CtaCanvasPreview",
      "RelatedLinksCanvasPreview",
      "GridCanvasPreview",
    ]) {
      expect(src).toContain(name);
    }
  });
});
