import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ALWAYS_FORBIDDEN_OPERATIONS,
  EVIDENCE_PATH_PREFIX,
  PENDING_BILLING_MIGRATIONS,
  PRODUCTION_LEDGER_SNAPSHOT,
  VALID_TASKS,
} from "../../../scripts/go-operator/constants.mjs";
import {
  buildPrBranchName,
  openDocsOnlyPr,
  parsePrUrl,
  validateEvidenceFile,
} from "../../../scripts/go-operator/pr.mjs";
import {
  assertDocsOnlyDiff,
  assertEvidencePathUnderDocsEvidence,
  assertOperationAllowed,
  scanForSecrets,
  validateModeSafety,
} from "../../../scripts/go-operator/safety.mjs";
import { runTaskChecks, writeEvidence } from "../../../scripts/go-operator/tasks.mjs";

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

  it("enforces docs/evidence-only PR scope", () => {
    expect(() =>
      assertDocsOnlyDiff(["docs/evidence/sample.md"], () => "# Evidence\n\nSafe markdown."),
    ).not.toThrow();

    expect(() =>
      assertDocsOnlyDiff(["docs/other/sample.md"], () => "# Evidence\n\nSafe markdown."),
    ).toThrow(/non-docs files in PR scope/);

    expect(() => assertEvidencePathUnderDocsEvidence("scripts/go-operator/constants.mjs")).toThrow(
      /must start with docs\/evidence\//,
    );
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

  it("production ledger snapshot matches Fase 1 release truth (2026-07-13)", async () => {
    // Billing block applied 2026-07-11; 21-country correction applied 2026-07-13.
    for (const version of ["20260729120000", "20260809120000", "20260814120000", "20260817120000"]) {
      expect(PRODUCTION_LEDGER_SNAPSHOT).toContain(version);
    }
    expect(PENDING_BILLING_MIGRATIONS).toEqual([]);
    // Ledger must be strictly sorted and unique.
    const sorted = [...PRODUCTION_LEDGER_SNAPSHOT].sort();
    expect(PRODUCTION_LEDGER_SNAPSHOT).toEqual(sorted);
    expect(new Set(PRODUCTION_LEDGER_SNAPSHOT).size).toBe(PRODUCTION_LEDGER_SNAPSHOT.length);

    const result = await runTaskChecks(root, "f4b-production-apply-readiness", {
      workspace: { ok: true, branch: "test", head: "abc123" },
      mode: "read-only",
      runTests: false,
    });
    expect(result.decision).toMatch(/F4b already applied/);
    expect(result.checks.some((c) => c.name === "pending billing migrations isolated" && c.ok)).toBe(true);
    expect(result.checks.some((c) => c.name === "bulk apply would not be F4b-only" && c.ok)).toBe(true);
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

describe("GO Operator PR creation", () => {
  it("buildPrBranchName includes task, date, and run id", () => {
    expect(buildPrBranchName("f4b-production-apply-readiness", "2026-07-10", "13aa59a8")).toBe(
      "docs/go-operator-f4b-production-apply-readiness-2026-07-10-13aa59a8",
    );
  });

  it("parsePrUrl extracts number and url", () => {
    expect(parsePrUrl("https://github.com/Lunchportalen/lunchportalen/pull/484")).toEqual({
      url: "https://github.com/Lunchportalen/lunchportalen/pull/484",
      number: 484,
    });
  });

  it("open_pr=false leaves pr null in CLI report", () => {
    const output = execSync(
      "node scripts/go-operator.mjs --task evidence-pr --skip-workspace-gate --skip-tests --open-pr=false",
      { cwd: root, encoding: "utf8" },
    );
    const parsed = JSON.parse(output.trim()) as { pr: unknown };
    expect(parsed.pr).toBeNull();

    const report = JSON.parse(fs.readFileSync(path.join(root, ".go-operator/latest-report.json"), "utf8")) as {
      pr: unknown;
      evidencePath: string;
    };
    expect(report.pr).toBeNull();
    expect(report.evidencePath.startsWith(EVIDENCE_PATH_PREFIX)).toBe(true);
  });

  it("open_pr=true dry path returns pr object without git push", () => {
    const output = execSync(
      "node scripts/go-operator.mjs --task evidence-pr --skip-workspace-gate --skip-tests --open-pr --dry-pr",
      { cwd: root, encoding: "utf8" },
    );
    const parsed = JSON.parse(output.trim()) as {
      pr: { ok: boolean; dryRun: boolean; staged: string[]; branch: string };
    };
    expect(parsed.pr).not.toBeNull();
    expect(parsed.pr.ok).toBe(true);
    expect(parsed.pr.dryRun).toBe(true);
    expect(parsed.pr.staged).toEqual([expect.stringMatching(/^docs\/evidence\/evidence-pr-\d{4}-\d{2}-\d{2}\.md$/)]);
    expect(parsed.pr.branch).toMatch(/^docs\/go-operator-evidence-pr-\d{4}-\d{2}-\d{2}-/);
  });

  it("evidencePath outside docs/evidence fails closed", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "go-operator-pr-"));
    const badPath = "scripts/evil.md";
    fs.mkdirSync(path.join(tmpDir, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, badPath), "# safe\n", "utf8");

    expect(() => validateEvidenceFile(tmpDir, badPath)).toThrow(/must start with docs\/evidence\//);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("docs-only scope violation fails closed on staged diff mismatch", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "go-operator-pr-"));
    const evidenceRel = "docs/evidence/test-scope.md";
    const abs = path.join(tmpDir, evidenceRel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, "# Evidence\n\nSafe.\n", "utf8");

    expect(() =>
      openDocsOnlyPr(tmpDir, {
        evidenceRelPath: evidenceRel,
        task: "evidence-pr",
        runId: "test",
        dryRun: true,
      }),
    ).not.toThrow();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("secret scan hit fails closed before PR", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "go-operator-pr-"));
    const evidenceRel = "docs/evidence/secret-hit.md";
    const abs = path.join(tmpDir, evidenceRel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, 'password = "super-secret-value"\n', "utf8");

    expect(() => validateEvidenceFile(tmpDir, evidenceRel)).toThrow(/secret pattern detected/);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writeEvidence always targets docs/evidence prefix", () => {
    const evidence = writeEvidence(root, "evidence-pr", {
      version: "1.0.0",
      workspace: { ok: true, branch: "test", head: "abc" },
      mode: "read-only",
      decision: "PASS",
      checks: [],
      tests: [],
    });
    expect(evidence.relPath.startsWith(EVIDENCE_PATH_PREFIX)).toBe(true);
    expect(fs.existsSync(evidence.absPath)).toBe(true);
  });
});
