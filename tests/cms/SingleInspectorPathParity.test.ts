/**
 * U82B: One property-editor path for block fields — BlockInspectorShell is navigator-only.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const shell = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "BlockInspectorShell.tsx"),
  "utf8",
);
const fields = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "BlockInspectorFields.tsx"),
  "utf8",
);

describe("SingleInspectorPathParity (U82B)", () => {
  it("BlockInspectorShell is navigator-only and does not import block field editors", () => {
    expect(shell).toContain('data-lp-block-inspector-shell="navigator-only"');
    expect(shell).toContain("data-lp-block-inspector-navigator-hint");
    expect(shell).not.toContain("HeroBlockEditor");
    expect(shell).not.toContain("CtaBlockEditor");
    expect(shell).not.toContain("ImageBlockEditor");
    expect(shell).not.toContain("DividerBlockEditor");
  });

  it("BlockInspectorFields remains the canonical property editor surface", () => {
    expect(fields).toContain("data-lp-inspector");
    expect(fields).toContain("data-lp-property-editor-surface");
    expect(fields).toContain("BlockPropertyEditorRouter");
  });
});
