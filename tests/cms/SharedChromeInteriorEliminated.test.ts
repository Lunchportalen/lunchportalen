/**
 * U80B: WorkspaceBody skal ikke bygge én delt chromeInterior for nøkkelblokkene.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("SharedChromeInteriorEliminated (U80B)", () => {
  it("WorkspaceBody bygger ikke lenger én delt chromeInterior for ramme-switch", () => {
    const body = fs.readFileSync(
      path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "WorkspaceBody.tsx"),
      "utf8",
    );
    expect(body).not.toMatch(/\bchromeInterior\b/);
    expect(body).not.toContain("chromeChildren=");
    expect(body).toContain("UmbracoBlockPropertyField");
    expect(body).toContain("PreviewCanvas");
  });

  it("nøkkelblokk-rammer importerer ikke chrome fra WorkspaceBody — eget layoutansvar", () => {
    const keyFrames = [
      "HeroCanvasFrame.tsx",
      "CardsCanvasFrame.tsx",
      "StepsCanvasFrame.tsx",
      "PricingCanvasFrame.tsx",
      "CtaCanvasFrame.tsx",
      "RelatedCanvasFrame.tsx",
      "GridCanvasFrame.tsx",
    ];
    const dir = path.join(root, "components", "cms", "blockCanvas", "frames");
    for (const f of keyFrames) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      expect(src).not.toContain("chromeChildren");
      expect(src).toContain("EditorBlockCanvasFrameProps");
      expect(src).toContain("BlockDragHandle");
      expect(src).toContain("BlockToolbar");
    }
  });
});
