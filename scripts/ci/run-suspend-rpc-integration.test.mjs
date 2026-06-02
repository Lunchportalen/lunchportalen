#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  SUSPEND_RPC_MIN_AUTHZ_TESTS,
  SUSPEND_RPC_MIN_PASSED_TESTS,
  evaluateSuspendRpcVitestReport,
} from "./run-suspend-rpc-integration.mjs";

const authzTitles = [
  "provider_kitchen cannot call lp_company_suspend",
  "provider_kitchen cannot call lp_company_pause",
  "provider_kitchen cannot call lp_company_delete",
  "provider_kitchen cannot call lp_company_resume",
  "provider_viewer cannot call lp_company_suspend",
  "provider_viewer cannot call lp_company_pause",
  "provider_viewer cannot call lp_company_delete",
  "provider_viewer cannot call lp_company_resume",
];

function authzAssertions(status) {
  return authzTitles.map((title) => ({ title, status }));
}

/** Vitest reports success=true when describe.skipIf skips entire suite — false-green baseline. */
const skippedReport = {
  success: true,
  numTotalTests: 14,
  numPassedTests: 0,
  numFailedTests: 0,
  numPendingTests: 14,
  testResults: [{ assertionResults: authzAssertions("skipped") }],
};

const passedReport = {
  success: true,
  numTotalTests: 14,
  numPassedTests: 14,
  numFailedTests: 0,
  numPendingTests: 0,
  testResults: [{ assertionResults: authzAssertions("passed") }],
};

const skippedGate = evaluateSuspendRpcVitestReport(skippedReport);
assert.equal(skippedGate.decision, "abort");
assert.equal(skippedGate.reason, "tests_skipped");
assert.equal(skippedReport.success, true);
console.log("evidence: skipped → abort (vitest alone would be green)");

const passedGate = evaluateSuspendRpcVitestReport(passedReport);
assert.equal(passedGate.decision, "proceed");
assert.equal(passedGate.passed, SUSPEND_RPC_MIN_PASSED_TESTS);
assert.equal(passedGate.authz, SUSPEND_RPC_MIN_AUTHZ_TESTS);
console.log("evidence: full pass → proceed");

const weakenedGate = evaluateSuspendRpcVitestReport({
  success: false,
  numTotalTests: 14,
  numPassedTests: 6,
  numFailedTests: 8,
  numPendingTests: 0,
  testResults: [{ assertionResults: authzAssertions("failed") }],
});
assert.equal(weakenedGate.decision, "abort");
assert.equal(weakenedGate.reason, "tests_failed");
console.log("evidence: weakened gate (authz failures) → abort");

const zeroReport = evaluateSuspendRpcVitestReport({
  success: true,
  numTotalTests: 0,
  numPassedTests: 0,
  numPendingTests: 0,
  numFailedTests: 0,
});
assert.equal(zeroReport.reason, "zero_tests_discovered");
console.log("evidence: zero tests → abort");

console.log(JSON.stringify({ ok: true, module: "run-suspend-rpc-integration" }, null, 2));
