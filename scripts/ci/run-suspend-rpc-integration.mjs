#!/usr/bin/env node
/**
 * CI runner: suspend-rpc authz integration (uigx only).
 * Fail-closed: abort if RUN_SUPABASE_INTEGRATION_TESTS unset, env incomplete,
 * vitest skips, or fewer than MIN_PASSED tests ran.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const SUSPEND_RPC_TEST_FILE = "tests/db/suspend-rpc.test.ts";
/** Full suite — includes 8 authz cases (kitchen/viewer × 4 lifecycle RPCs). */
export const SUSPEND_RPC_MIN_PASSED_TESTS = 14;
export const SUSPEND_RPC_MIN_AUTHZ_TESTS = 8;

const ENABLED_VALUES = new Set(["1", "true", "on", "yes"]);
const STAGING_REF = "uigxsboqeruxflgzqztl";
const PROD_REF = "hkpokyapzarefrgqzkos";

/**
 * @typedef {{ decision: "proceed" | "abort", reason: string, passed?: number, skipped?: number, failed?: number, authz?: number }} GateResult
 */

/**
 * @param {unknown} report
 * @returns {GateResult}
 */
export function evaluateSuspendRpcVitestReport(report) {
  const r = /** @type {Record<string, unknown>} */ (report ?? {});
  const passed = Number(r.numPassedTests ?? 0);
  const failed = Number(r.numFailedTests ?? 0);
  const pending = Number(r.numPendingTests ?? 0);
  const total = Number(r.numTotalTests ?? 0);
  const success = r.success === true;

  if (total === 0) {
    return { decision: "abort", reason: "zero_tests_discovered", passed, skipped: pending, failed };
  }

  if (pending > 0) {
    return { decision: "abort", reason: "tests_skipped", passed, skipped: pending, failed };
  }

  if (failed > 0 || !success) {
    return { decision: "abort", reason: "tests_failed", passed, skipped: pending, failed };
  }

  if (passed < SUSPEND_RPC_MIN_PASSED_TESTS) {
    return { decision: "abort", reason: "insufficient_passed", passed, skipped: pending, failed };
  }

  let authz = 0;
  const testResults = Array.isArray(r.testResults) ? r.testResults : [];
  for (const file of testResults) {
    const assertions = Array.isArray(file?.assertionResults) ? file.assertionResults : [];
    for (const a of assertions) {
      const title = String(a?.title ?? "");
      const status = String(a?.status ?? "");
      if (
        status === "passed" &&
        /provider_(kitchen|viewer) cannot call lp_company_(suspend|pause|delete|resume)/.test(title)
      ) {
        authz += 1;
      }
    }
  }

  if (authz < SUSPEND_RPC_MIN_AUTHZ_TESTS) {
    return { decision: "abort", reason: "authz_subset_missing", passed, skipped: pending, failed, authz };
  }

  return { decision: "proceed", reason: "ok", passed, skipped: pending, failed, authz };
}

function integrationFlagEnabled() {
  const raw = String(
    process.env.RUN_SUPABASE_INTEGRATION_TESTS ?? process.env.VITEST_SUPABASE_INTEGRATION ?? "",
  )
    .trim()
    .toLowerCase();
  return ENABLED_VALUES.has(raw);
}

function assertStagingOnly() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();
  const pg = String(
    process.env.SUPABASE_POSTGRES_URL ??
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.DATABASE_URL ??
      "",
  ).trim();

  for (const [label, value] of [
    ["NEXT_PUBLIC_SUPABASE_URL", url],
    ["SUPABASE_POSTGRES_URL", pg],
  ]) {
    if (!value) {
      throw new Error(`Missing ${label}`);
    }
    if (value.includes(PROD_REF)) {
      throw new Error(`REFUSE_PROD_${label}: integration gate must use uigx (${STAGING_REF})`);
    }
    if (!value.includes(STAGING_REF)) {
      throw new Error(`REFUSE_NON_STAGING_${label}: expected ref ${STAGING_REF}`);
    }
  }

  if (!String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim()) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
}

function runVitestJsonReport() {
  const dir = mkdtempSync(join(tmpdir(), "suspend-rpc-gate-"));
  const reportPath = join(dir, "vitest.json");
  try {
    execFileSync(
      "npx",
      [
        "vitest",
        "run",
        SUSPEND_RPC_TEST_FILE,
        "--pool=threads",
        "--reporter=json",
        `--outputFile=${reportPath}`,
      ],
      { stdio: "inherit", env: process.env },
    );
    return JSON.parse(readFileSync(reportPath, "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  if (!integrationFlagEnabled()) {
    console.error("::error::suspend-rpc-gate: RUN_SUPABASE_INTEGRATION_TESTS must be 1 (skip-guard)");
    process.exit(1);
  }

  try {
    assertStagingOnly();
  } catch (err) {
    console.error(`::error::suspend-rpc-gate: ${/** @type {Error} */ (err).message}`);
    process.exit(1);
  }

  console.log("suspend-rpc-gate: running integration tests on uigx");

  let report;
  try {
    report = runVitestJsonReport();
  } catch {
    console.error("::error::suspend-rpc-gate: vitest exited non-zero");
    process.exit(1);
  }

  const gate = evaluateSuspendRpcVitestReport(report);
  console.log(
    `suspend-rpc-gate decision=${gate.decision} reason=${gate.reason} passed=${gate.passed} authz=${gate.authz ?? 0}`,
  );

  if (gate.decision !== "proceed") {
    console.error(`::error::suspend-rpc-gate ABORT (${gate.reason}) — skipped/false-green not allowed`);
    process.exit(1);
  }

  console.log("suspend-rpc-gate: OK");
}

const isMain = process.argv[1]?.includes("run-suspend-rpc-integration.mjs");
if (isMain) {
  main();
}
