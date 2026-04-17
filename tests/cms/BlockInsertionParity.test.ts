import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workspaceBody = fs.readFileSync(
  path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "WorkspaceBody.tsx"),
  "utf8",
);

describe("Block insertion parity (low-noise slots)", () => {
  it("uses compact insert gutters instead of full-width dashed mega-zones between blocks", () => {
    expect(workspaceBody).toContain("data-lp-insert-slot");
    expect(workspaceBody).toContain("group/ins");
    expect(workspaceBody).not.toContain("max-w-xl");
    expect(workspaceBody).not.toContain("min-h-[40px] w-full");
  });

  it("keeps a single explicit end insertion affordance", () => {
    expect(workspaceBody).toContain("data-lp-insert-end");
    const endOccurrences = workspaceBody.split("data-lp-insert-end").length - 1;
    expect(endOccurrences).toBe(1);
  });
});
