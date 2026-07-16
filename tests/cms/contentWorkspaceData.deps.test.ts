/**
 * Static contract checks for useContentWorkspaceData (node — no jsdom fs shim).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, test } from "vitest";

describe("ContentWorkspace stability – detail effect deps", () => {
  test("detail effect deps documented to avoid fetch loop", () => {
    const p = join(
      process.cwd(),
      "app",
      "(backoffice)",
      "backoffice",
      "content",
      "_components",
      "useContentWorkspaceData.ts",
    );
    const src = readFileSync(p, "utf8");
    expect(src).toContain("[selectedId, refetchDetailKey");
    expect(src).toMatch(/Intentionally omit|would retrigger|fetch loop/i);
  });

  test("detail run-id guard present to avoid stale response apply", () => {
    const p = join(
      process.cwd(),
      "app",
      "(backoffice)",
      "backoffice",
      "content",
      "_components",
      "useContentWorkspaceData.ts",
    );
    const src = readFileSync(p, "utf8");
    expect(src).toContain("detailRunIdRef");
    expect(src).toContain("runId !== detailRunIdRef.current");
  });
});
