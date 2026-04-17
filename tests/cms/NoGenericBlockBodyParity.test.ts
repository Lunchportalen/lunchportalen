/**
 * U77: canvas-kroppen skal ikke være én felles "summary + chips"-mal for nøkkelblokker.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("NoGenericBlockBodyParity (U77)", () => {
  const collapsedPath = path.join(
    root,
    "app",
    "(backoffice)",
    "backoffice",
    "content",
    "_components",
    "BlockCollapsedPreview.tsx",
  );
  const collapsed = fs.readFileSync(collapsedPath, "utf8");

  it("BlockCollapsedPreview bruker ikke sammendragstekst som hovedkropp for nøkkelblokker", () => {
    const fnStart = collapsed.indexOf("export function BlockCollapsedPreview");
    expect(fnStart).toBeGreaterThan(0);
    const fnSlice = collapsed.slice(fnStart);
    expect(fnSlice).not.toMatch(/blockCollapsedPreviewSummary\s*\(\s*block\s*\)/);
  });

  it("nøkkelblokker mappes til dedikerte canvas-komponenter", () => {
    expect(collapsed).toMatch(/<HeroCanvasPreview\b/);
    expect(collapsed).toMatch(/<CardsCanvasPreview\b/);
    expect(collapsed).toMatch(/<StepsCanvasPreview\b/);
    expect(collapsed).toMatch(/<PricingCanvasPreview\b/);
    expect(collapsed).toMatch(/<CtaCanvasPreview\b/);
    expect(collapsed).toMatch(/<RelatedLinksCanvasPreview\b/);
    expect(collapsed).toMatch(/<GridCanvasPreview\b/);
  });
});
