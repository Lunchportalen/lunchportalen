import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const blockCard = fs.readFileSync(path.join(root, "components", "cms", "BlockCard.tsx"), "utf8");
const inspectorCard = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "ContentWorkspacePropertiesInspectorCard.tsx"),
  "utf8",
);
const rail = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "ContentWorkspacePropertiesRail.tsx"),
  "utf8",
);
const inspectorPanels = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "useContentWorkspaceInspectorPanels.tsx"),
  "utf8",
);

describe("Block selection + inspector coupling parity", () => {
  it("uses stronger selected chrome than hover-only sync (pink ring + accent bar vs slate hover)", () => {
    const selectedBranch = blockCard.slice(blockCard.indexOf("selected"));
    expect(selectedBranch).toMatch(/ring-2\s+ring-pink-500/);
    expect(selectedBranch).toContain("data-lp-block-selection-accent");
    expect(blockCard).toContain("hoverSync ?");
    expect(blockCard).toContain("bg-slate-50/55");
    expect(blockCard).not.toMatch(/hoverSync[\s\S]{0,120}ring-pink-500/);
  });

  it("binds inspector card to the active block id and repeats block identity", () => {
    expect(inspectorCard).toContain("data-lp-inspector-block-root");
    expect(inspectorCard).toContain("data-lp-inspector-block-id={selectedBlockForInspector.id}");
    expect(inspectorCard).toContain("Valgt blokk");
    expect(inspectorCard).toContain("getBlockLabel(selectedBlockForInspector.type)");
    expect(inspectorCard).toContain("selectedBlockOrdinal");
  });

  it("computes ordinal from the canonical blocks list in the properties rail", () => {
    expect(rail).toContain("selectedBlockOrdinal");
    expect(rail).toContain("selectedBlockOrdinal={selectedBlockOrdinal}");
    expect(inspectorPanels).toContain("blocks.findIndex");
  });
});
