import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const PROBE = join(process.cwd(), "app", "(app)", "week", "__lint_probe__.tsx");

describe("lint:design-tokens week scope gate", () => {
  test("PASS on clean week/employee scope", () => {
    const out = execFileSync("node", ["scripts/lint-design-tokens.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(out).toContain("PASS");
  });

  test("FAIL catches deliberate rounded-[…] violation then PASS after removal", () => {
    writeFileSync(
      PROBE,
      `export default function LintProbe() {
  return <div className="rounded-[2rem] bg-white" />;
}
`,
    );

    try {
      expect(() =>
        execFileSync("node", ["scripts/lint-design-tokens.mjs"], {
          cwd: process.cwd(),
          stdio: ["pipe", "pipe", "pipe"],
        }),
      ).toThrow();
    } finally {
      rmSync(PROBE, { force: true });
    }

    const clean = execFileSync("node", ["scripts/lint-design-tokens.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(clean).toContain("PASS");
  });
});
