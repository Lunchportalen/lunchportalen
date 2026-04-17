import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workspaceBody = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "WorkspaceBody.tsx"),
  "utf8",
);
const blockCard = fs.readFileSync(path.join(root, "components", "cms", "BlockCard.tsx"), "utf8");
const shell = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "ContentWorkspaceShell.tsx"),
  "utf8",
);

describe("Editor density parity", () => {
  it("avoids the oversized trailing insert control", () => {
    expect(workspaceBody).not.toContain("min-h-[52px]");
    expect(workspaceBody).toContain("UmbracoBlockPropertyField");
  });

  it("tightens the primary editor section padding versus xl card stacks", () => {
    expect(workspaceBody).toContain("rounded-md");
    expect(workspaceBody).toContain("p-3");
    expect(workspaceBody).not.toMatch(/rounded-2xl[\s\S]{0,80}p-4 shadow-sm sm:p-5/);
  });

  it("keeps block shells visually compact (radius + no hover scale)", () => {
    expect(blockCard).toContain("rounded-lg border bg-white");
    expect(blockCard).not.toContain("scale(1.01)");
  });

  it("gives the canvas column more room than the legacy tree rail cap", () => {
    expect(shell).toContain("minmax(300px,min(36vw,460px))");
  });
});
