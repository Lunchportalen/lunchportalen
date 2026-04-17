import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { blockCollapsedPreviewSummary } from "@/app/(backoffice)/backoffice/content/_components/BlockCollapsedPreview";
import { normalizeBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";
import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";

/** U76: canvas-forhåndsvisning er blokkspesifikk — ikke samme radmal for alle. */
describe("BlockCustomViewParity (U76)", () => {
  const root = process.cwd();
  const previewPath = path.join(
    root,
    "app",
    "(backoffice)",
    "backoffice",
    "content",
    "_components",
    "BlockCollapsedPreview.tsx",
  );
  const canvasDir = path.join(root, "components", "cms", "blockCanvas");
  const canvasFiles = fs.readdirSync(canvasDir).filter((f) => f.endsWith(".tsx"));
  const src = [fs.readFileSync(previewPath, "utf8"), ...canvasFiles.map((f) => fs.readFileSync(path.join(canvasDir, f), "utf8"))].join(
    "\n",
  );

  it("kilde: rutenett bruker eget lattice-preview (ikke kort-stakk)", () => {
    expect(src).toContain("data-lp-preview-grid-lattice");
    expect(src).toContain('data-lp-canvas-view="grid"');
    expect(src).toContain('data-lp-block-preview-kind="grid"');
  });

  it("kilde: kort, steg, pris, CTA og relaterte har ulike preview-markører", () => {
    expect(src).toContain("data-lp-preview-card-stack");
    expect(src).toContain("data-lp-preview-step-stack");
    expect(src).toContain("data-lp-preview-pricing-tiers");
    expect(src).toContain("data-lp-preview-cta-actions");
    expect(src).toContain("data-lp-preview-related-strip");
  });

  it("kilde: hero overflate skiller standard vs full bredde", () => {
    expect(src).toContain("data-lp-preview-hero-surface");
  });

  it("sammendrag: grid vs cards deler ikke samme signatur for like data", () => {
    const cards = normalizeBlock({
      id: "1",
      type: "cards",
      title: "T",
      text: "",
      presentation: "plain",
      items: [{ title: "A", text: "b" }],
      cta: [],
    }) as Block;
    const grid = normalizeBlock({
      id: "2",
      type: "grid",
      title: "T",
      intro: "",
      variant: "center",
      items: [{ title: "A", subtitle: "", metaLine: "", imageId: "x" }],
    }) as Block;
    const sc = blockCollapsedPreviewSummary(cards);
    const sg = blockCollapsedPreviewSummary(grid);
    expect(sc).toMatch(/kort/i);
    expect(sg).toMatch(/Rutenett|celler|Lokasjonsrutenett/i);
    expect(sc).not.toEqual(sg);
  });
});
