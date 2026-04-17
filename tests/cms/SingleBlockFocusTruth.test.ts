/**
 * U82B: One canonical block focus id — no parallel expandedBlockId / onToggleBlock competing truth.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const blocksHook = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "useContentWorkspaceBlocks.ts"),
  "utf8",
);
const uiHook = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "useContentWorkspaceUi.ts"),
  "utf8",
);
const tree = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "EditorStructureTree.tsx"),
  "utf8",
);

describe("SingleBlockFocusTruth (U82B)", () => {
  it("blocks hook does not own expandedBlockId or onToggleBlock", () => {
    expect(blocksHook).not.toContain("expandedBlockId");
    expect(blocksHook).not.toContain("onToggleBlock");
  });

  it("tree uses selectedBlockId for expand visual, not a second id prop", () => {
    expect(tree).toContain("selectedBlockId === block.id");
    expect(tree).not.toContain("expandedBlockId");
    expect(tree).not.toContain("onToggleBlock");
  });

  it("useContentWorkspaceUi does not sync a second block focus setter", () => {
    expect(uiHook).not.toContain("setExpandedBlockId");
  });
});
