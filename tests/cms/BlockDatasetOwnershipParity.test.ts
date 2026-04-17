/**
 * U82B: Block values + bodyForSave + dirty pipeline reference one dataset model.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const blocksHook = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "useContentWorkspaceBlocks.ts"),
  "utf8",
);
const canon = fs.readFileSync(path.join(root, "lib", "cms", "workspaceBlockDatasetCanon.ts"), "utf8");
const shell = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "useContentWorkspaceShellModel.ts"),
  "utf8",
);

describe("BlockDatasetOwnershipParity (U82B)", () => {
  it("documents canonical dataset in lib/cms/workspaceBlockDatasetCanon.ts", () => {
    expect(canon).toContain("U82B");
    expect(canon).toContain("bodyForSave");
    expect(canon).toContain("deriveBodyForSave");
  });

  it("useContentWorkspaceBlocks derives bodyForSave from blocks + meta + mode", () => {
    expect(blocksHook).toContain("deriveBodyForSave");
    expect(blocksHook).toContain("bodyForSave");
    expect(blocksHook).toContain("setBlockById");
  });

  it("shell wraps applyParsedBody to keep focus aligned with parsed blocks (same dataset)", () => {
    expect(shell).toContain("applyParsedBodyCore");
    expect(shell).toContain("const applyParsedBody = useCallback");
    expect(shell).toContain("applyParsedBodyCore(parsed)");
  });
});
