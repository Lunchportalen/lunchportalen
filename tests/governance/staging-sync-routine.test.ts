/**
 * Staging sync routine — static doc + script contract (check-only by default).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = process.cwd();
const RUNBOOK = "docs/operations/staging-sync-routine.md";
const SCRIPT = "scripts/staging/verify-main-to-staging-fast-forward.mjs";

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("Staging sync routine — housekeeping", () => {
  test("runbook documents manual fast-forward and STOP conditions", () => {
    const doc = read(RUNBOOK);
    expect(doc).toMatch(/origin\/staging/);
    expect(doc).toMatch(/origin\/main/);
    expect(doc).toMatch(/git push origin.*:staging/);
    expect(doc).toMatch(/fast-forward/i);
    expect(doc).toMatch(/origin\/main\.\.origin\/staging.*empty|must be empty/i);
    expect(doc).toMatch(/Production touched.*NO|NOT production promote/i);
    expect(doc).toMatch(/LP_MENU_PROFILE_/);
    expect(doc).toMatch(/G5d\.8/);
    expect(doc).toMatch(/auto-rollout/i);
    expect(doc).toMatch(/manual/i);
  });

  test("verify script is dry-run by default and does not push without --apply", () => {
    const src = read(SCRIPT);
    expect(src).toMatch(/dry-run|Dry-run/i);
    expect(src).toMatch(/--apply/);
    expect(src).toMatch(/if \(!apply\)/);
    expect(src).toMatch(/Applying promotion \(--apply\)/);
    expect(src).toMatch(/aheadOnStaging/);
    expect(src).toMatch(/process\.exit\(1\)/);
  });
});
