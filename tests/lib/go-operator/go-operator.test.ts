import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ALWAYS_FORBIDDEN_OPERATIONS, VALID_TASKS } from "../../../scripts/go-operator/constants.mjs";
import {
  assertDocsOnlyDiff,
  assertOperationAllowed,
  scanForSecrets,
  validateModeSafety,
} from "../../../scripts/go-operator/safety.mjs";
import { runTaskChecks } from "../../../scripts/go-operator/tasks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("GO Operator safety", () => {
  it("read-only mode blocks production mutation flag", () => {
    expect(() => validateModeSafety("read-only", true)).toThrow(/incompatible with read-only/);
    expect(() => assertOperationAllowed("production_readback", { allowProductionMutation: false })).toThrow(
      /requires allow_production_mutation=true/,
    );
  });

  it("production mode requires explicit allow_production_mutation", () => {
    expect(() => validateModeSafety("production", false)).toThrow(/requires allow_production_mutation=true/);
    expect(() => validateModeSafety("production", true)).not.toThrow();
  });

  it("enforces docs-only PR scope", () => {
    expect(() =>
      assertDocsOnlyDiff(["docs/evidence/sample.md"], () => "# Evidence\n\nSafe markdown."),
    ).not.toThrow();

    expect(() =>
      assertDocsOnlyDiff(["scripts/go-operator/constants.mjs"], () => "export const X = 1;"),
    ).toThrow(/non-docs files in PR scope/);
  });

  it("secret scan stops docs-only PR", () => {
    const hits = scanForSecrets('password = "super-secret-value"');
    expect(hits.length).toBeGreaterThan(0);

    expect(() =>
      assertDocsOnlyDiff(["docs/evidence/leak.md"], () => 'password = "super-secret-value"'),
    ).toThrow(/secret pattern detected/);
  });

  it("blocks SOT and auto-rollout operations always", () => {
    for (const op of ["sot_start", "auto_rollout", "supabase_apply", "lp_order_set_mutation"]) {
      expect(ALWAYS_FORBIDDEN_OPERATIONS).toContain(op);
      expect(() => assertOperationAllowed(op, { allowProductionMutation: true })).toThrow(/always forbidden/);
    }
  });

  it("unknown task fails fail-closed", () => {
    expect(VALID_TASKS).not.toContain("rollout-production-now");
    try {
      execSync("node scripts/go-operator.mjs --task rollout-production-now --skip-workspace-gate --skip-tests", {
        cwd: root,
        stdio: "pipe",
        encoding: "utf8",
      });
      expect.fail("expected non-zero exit");
    } catch (err) {
      const output = [
        err && typeof err === "object" && "stdout" in err ? String(err.stdout ?? "") : "",
        err && typeof err === "object" && "stderr" in err ? String(err.stderr ?? "") : "",
      ].join("\n");
      expect(output).toMatch(/unknown task/i);
    }
  });

  it("f4b-readiness runs without mutation", async () => {
    const result = await runTaskChecks(root, "f4b-readiness", {
      workspace: { ok: true, branch: "test", head: "abc123" },
      mode: "read-only",
      runTests: false,
    });

    expect(result.checks.some((c) => c.name === "F4b migration file" && c.ok)).toBe(true);
    expect(result.checks.some((c) => c.name === "no broad UPDATE/DELETE" && c.ok)).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("writes machine-readable report path contract", async () => {
    const reportDir = path.join(root, ".go-operator");
    const reportPath = path.join(reportDir, "latest-report.json");
    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as Record<string, unknown>;
      expect(report).toHaveProperty("safety");
    }
  });
});
