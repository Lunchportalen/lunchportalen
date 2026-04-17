/**
 * U82B: Legacy app BlockCanvas.tsx removed; canonical path is WorkspaceBody + components/cms/blockCanvas/frames.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("NoDeadCanvasPath (U82B)", () => {
  it("does not ship the unused backoffice BlockCanvas.tsx", () => {
    const legacy = path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "BlockCanvas.tsx");
    expect(fs.existsSync(legacy)).toBe(false);
  });

  it("WorkspaceBody wires Hero/Cards/Steps frames from components/cms/blockCanvas", () => {
    const body = fs.readFileSync(
      path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "WorkspaceBody.tsx"),
      "utf8",
    );
    expect(body).toContain("@/components/cms/blockCanvas/frames");
    expect(body).toContain("HeroCanvasFrame");
  });
});
