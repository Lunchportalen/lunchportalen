import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workspaceBody = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "WorkspaceBody.tsx"),
  "utf8",
);
const blockChromeRow = fs.readFileSync(
  path.join(root, "components", "cms", "blockCanvas", "frames", "BlockChromeRow.tsx"),
  "utf8",
);
const blockCard = fs.readFileSync(path.join(root, "components", "cms", "BlockCard.tsx"), "utf8");
const blockToolbar = fs.readFileSync(path.join(root, "components", "cms", "BlockToolbar.tsx"), "utf8");
function readAllCanvasFrameSources(): string {
  const dir = path.join(root, "components", "cms", "blockCanvas", "frames");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith("CanvasFrame.tsx"))
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
    .join("\n");
}

describe("Block chrome parity (Umbraco-grade structure)", () => {
  it("keeps a dedicated chrome row with drag column and inline action cluster on the canonical canvas", () => {
    const framesJoined = readAllCanvasFrameSources();
    expect(blockChromeRow).toContain("data-lp-block-chrome");
    expect(framesJoined).toContain("BlockDragHandle");
    expect(framesJoined).toContain('attach="inline"');
    expect(blockToolbar).toContain("data-lp-block-actions");
  });

  it("surfaces stable block identity attributes on the card shell", () => {
    expect(blockCard).toContain("data-lp-block-card");
    expect(blockCard).toContain("data-lp-block-selected");
    expect(blockCard).toContain("data-lp-block-hover-sync");
    expect(blockCard).toContain("data-lp-block-selection-accent");
  });

  it("keeps toolbar actions grouped with a stable test hook", () => {
    expect(blockToolbar).toContain("data-lp-block-actions");
  });

  it("U82B: legacy BlockCanvas list component removed — canonical canvas is WorkspaceBody + blockCanvas/frames", () => {
    const legacyPath = path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "BlockCanvas.tsx");
    expect(fs.existsSync(legacyPath)).toBe(false);
    expect(workspaceBody).toContain("data-lp-canvas-selected-scan");
    expect(workspaceBody).toContain("BlockCard");
  });
});
