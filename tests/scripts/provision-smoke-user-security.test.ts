import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Security regression guard for scripts/smoke/provision-smoke-user.mjs.
 *
 * Background: the script previously wrote the smoke-test user's plaintext
 * password to `.smoke-provision.meta.json` on local disk. The password must
 * only live in `.env.local` (PLAYWRIGHT_TEST_PASSWORD) — never in any other
 * file and never in console output.
 */

const ROOT = path.resolve(__dirname, "../..");
const SCRIPT_PATH = path.join(ROOT, "scripts", "smoke", "provision-smoke-user.mjs");
const src = fs.readFileSync(SCRIPT_PATH, "utf8");

/** Strip string literals so identifier checks ignore human-readable text. */
function stripStringLiterals(code: string): string {
  return code
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

describe("provision-smoke-user.mjs — password never touches disk (except .env.local)", () => {
  it("does not write .smoke-provision.meta.json at all", () => {
    expect(src).not.toContain(".smoke-provision.meta.json");
  });

  it("has exactly two writeFileSync targets: .env.local merge + .smoke-provision.sql", () => {
    const writes = src.match(/writeFileSync/g) ?? [];
    expect(writes).toHaveLength(2);
    // The two sanctioned writes must still be present (and nothing else).
    expect(src).toContain('path.join(process.cwd(), ".env.local")');
    expect(src).toContain('path.join(process.cwd(), ".smoke-provision.sql")');
  });

  it("does not interpolate the password into the SQL artifact or any template", () => {
    expect(src).not.toContain("${password}");
    expect(src).not.toContain("${newPassword}");
  });

  it("never logs the password (no console call references the password identifier)", () => {
    const withoutStrings = stripStringLiterals(src);
    const consoleLines = withoutStrings
      .split(/\r?\n/)
      .filter((line) => /console\.\w+/.test(line));
    for (const line of consoleLines) {
      expect(line).not.toMatch(/\bpassword\b/i);
    }
  });

  it("keeps the staging-only guard: hard fail unless URL points to staging project", () => {
    expect(src).toContain("uigxsboqeruxflgzqztl");
    const guard = src.match(/if \(!url\.includes\("uigxsboqeruxflgzqztl"\)\) \{[\s\S]*?process\.exit\(1\);/);
    expect(guard).not.toBeNull();
  });
});

describe("repo hygiene around smoke provisioning", () => {
  it(".smoke-provision.* stays gitignored", () => {
    const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    expect(gitignore.split(/\r?\n/)).toContain(".smoke-provision.*");
  });

  it("no CI workflow depends on .smoke-provision files", () => {
    const workflowDir = path.join(ROOT, ".github", "workflows");
    const files = fs.readdirSync(workflowDir).filter((f) => /\.ya?ml$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = fs.readFileSync(path.join(workflowDir, file), "utf8");
      expect(content).not.toContain(".smoke-provision");
    }
  });
});
