/**
 * U82B: Dirty and save compare the same serialized body as bodyForSave.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const shell = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "useContentWorkspaceShellModel.ts"),
  "utf8",
);

describe("SaveDirtyPipelineParity (U82B)", () => {
  it("currentSnapshot uses bodyForSave for dirty comparison", () => {
    expect(shell).toContain("const currentSnapshot = useMemo");
    expect(shell).toContain("makeSnapshot({ title, slug, body: bodyForSave })");
  });

  it("dirty compares currentSnapshot to savedSnapshot", () => {
    expect(shell).toContain("const dirty = useMemo");
    expect(shell).toContain("currentSnapshot !== savedSnapshot");
  });
});
