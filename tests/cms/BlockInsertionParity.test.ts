import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workspaceBody = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "WorkspaceBody.tsx"),
  "utf8",
);

describe("Block insertion parity (low-noise slots)", () => {
  it("module list exposes add affordance via UmbracoBlockPropertyField onAdd", () => {
    expect(workspaceBody).toContain("UmbracoBlockPropertyField");
    expect(workspaceBody).toContain("onAdd={() => {");
    expect(workspaceBody).not.toContain("max-w-xl");
  });

  it("avoids legacy full-width dashed insert mega-zones", () => {
    expect(workspaceBody).not.toContain("min-h-[40px] w-full");
  });
});
