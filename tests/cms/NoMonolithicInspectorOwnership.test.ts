/**
 * U84: BlockInspectorFields er tynn skall — ikke hovedeier av editorlogikk.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fieldsPath = path.join(
  root,
  "app",
  "(backoffice)",
  "backoffice",
  "content",
  "_components",
  "BlockInspectorFields.tsx",
);

describe("NoMonolithicInspectorOwnership (U84)", () => {
  it("BlockInspectorFields er kort og delegerer til BlockPropertyEditorRouter", () => {
    const src = fs.readFileSync(fieldsPath, "utf8");
    const lines = src.split(/\r?\n/).length;
    expect(lines).toBeLessThan(220);
    expect(src).toContain("BlockPropertyEditorRouter");
    expect(src).not.toContain("block.type === ");
    expect(src).not.toContain("setBlockById(block.id");
  });
});
