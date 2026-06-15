import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const WORKFLOW_PATH = join(process.cwd(), ".github", "workflows", "supabase-migrate.yml");

describe("supabase-migrate staging dry-run gating", () => {
  test("skips staging dry-run when PR has no supabase/migrations changes", () => {
    const source = readFileSync(WORKFLOW_PATH, "utf-8");

    expect(source).toContain("Staging dry-run skipped (no migration changes in PR)");
    expect(source).toContain("DB dry-run skipped: no database-affecting migration files changed in this PR.");
    expect(source).toMatch(
      /- name: Staging dry-run \(guard verify, pinned CLI\)\s*\n\s*if: steps\.mig_diff\.outputs\.changed == 'true'/,
    );
    expect(source).toMatch(
      /- name: Staging dry-run skipped \(no migration changes in PR\)\s*\n\s*if: steps\.mig_diff\.outputs\.changed != 'true'/,
    );
  });

  test("still applies migrations on staging only when mig_diff changed", () => {
    const source = readFileSync(WORKFLOW_PATH, "utf-8");
    expect(source).toContain(
      "if: steps.mig_diff.outputs.changed == 'true' && github.event.pull_request.draft == false",
    );
  });
});
