/**
 * Structural smoke: canonical editor canvas files expose Umbraco-parity hooks.
 * Complements Block*Parity tests; no browser/screenshot dependency.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [
  ["WorkspaceBody", path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "WorkspaceBody.tsx")],
  ["BlockCard", path.join(root, "components", "cms", "BlockCard.tsx")],
  ["BlockCollapsedPreview", path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "BlockCollapsedPreview.tsx")],
  ["BlockChromeRow", path.join(root, "components", "cms", "blockCanvas", "frames", "BlockChromeRow.tsx")],
] as const;

describe("editor canvas parity smoke", () => {
  it("retains preview + chrome markers across the hot path", () => {
    for (const [, fp] of files) {
      const src = fs.readFileSync(fp, "utf8");
      expect(src.length).toBeGreaterThan(200);
    }
    const body = fs.readFileSync(files[0][1], "utf8");
    const chromeRow = fs.readFileSync(files[3][1], "utf8");
    expect(chromeRow).toContain("data-lp-block-chrome");
    expect(body).toContain("UmbracoBlockPropertyField");
    const collapsed = fs.readFileSync(files[2][1], "utf8");
    expect(collapsed).toContain("data-lp-block-preview");
  });
});
