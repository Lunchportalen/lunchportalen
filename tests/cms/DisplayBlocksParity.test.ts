/**
 * U82B: displayBlocks is a read-only projection; inspector uses canonical blocks by id.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const shell = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "useContentWorkspaceShellModel.ts"),
  "utf8",
);
const ui = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "useContentWorkspaceUi.ts"),
  "utf8",
);

describe("DisplayBlocksParity (U82B)", () => {
  it("shell documents displayBlocks as read-only canvas projection", () => {
    expect(shell).toContain("Read-only canvas projection");
    expect(shell).toContain("const displayBlocks = useMemo");
  });

  it("selectedBlockForInspector resolves from blocks only", () => {
    expect(ui).toContain("selectedBlockForInspector = useMemo");
    expect(ui).toMatch(/blocks\.find\(\(b\) => b\.id === selectedBlockId\)/);
    expect(ui.slice(ui.indexOf("selectedBlockForInspector"))).not.toMatch(
      /displayBlocks\.find\(\(b\) => b\.id === selectedBlockId\)/,
    );
  });
});
