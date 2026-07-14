#!/usr/bin/env node
/**
 * RC orchestrator fail-closed behavior tests (10/10 required for Phase 14 remediation).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  exitCodeForResults,
  finalBanner,
  runStepCore,
  summarizeResults,
} from "../verify/rcOrchestratorCore.mjs";

const isWin = process.platform === "win32";
const failCmd = isWin ? "cmd /c exit 1" : "false";
const okCmd = isWin ? "cmd /c exit 0" : "true";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rc-orch-"));
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`OK: ${name}`);
    passed += 1;
  } catch (e) {
    console.error(`FAIL: ${name}`);
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}

test("1. typecheck failure → non-zero exit", () => {
  const r = runStepCore("t", "typecheck", failCmd);
  assert.equal(r.pass, false);
  assert.equal(exitCodeForResults([r]), 1);
});

test("2. lint failure → non-zero exit", () => {
  const r = runStepCore("l", "lint", failCmd);
  assert.equal(r.pass, false);
  assert.equal(exitCodeForResults([r]), 1);
});

test("3. build failure → non-zero exit", () => {
  const r = runStepCore("b", "build", failCmd, { productionNodeEnv: true });
  assert.equal(r.pass, false);
  const sum = summarizeResults([r]);
  assert.equal(sum.pass, false);
  assert.match(sum.failures[0], /build/);
});

test("4. vitest failure → non-zero exit", () => {
  const r = runStepCore("v", "vitest", failCmd);
  assert.equal(exitCodeForResults([r]), 1);
});

test("5. RLS failure → non-zero exit", () => {
  const r = runStepCore("r", "rls", failCmd);
  assert.equal(exitCodeForResults([r]), 1);
});

test("6. golden path failure → non-zero exit", () => {
  const r = runStepCore("g", "golden-path", failCmd);
  assert.equal(exitCodeForResults([r]), 1);
});

test("7. manifest failure — missing artifact → non-zero exit", () => {
  const dir = tmpDir();
  const r = runStepCore("m", "manifest", okCmd, {
    cwd: dir,
    requiredArtifact: path.join(dir, "missing-manifest.md"),
  });
  assert.equal(r.pass, false);
  assert.equal(exitCodeForResults([r]), 1);
});

test("8. staging skipped when required — extra failure fails closed", () => {
  const localResults = [runStepCore("ok", "typecheck", okCmd)];
  const skippedStagingFailure = ["staging integration required but skipped (--local-only)"];
  assert.equal(exitCodeForResults(localResults, skippedStagingFailure), 1);
  assert.match(finalBanner(false, false), /FAILED/);
});

test("9. timeout → non-zero exit", () => {
  const hang = isWin ? "cmd /c ping -n 6 127.0.0.1 >nul" : "sleep 6";
  const r = runStepCore("hang", "timeout-step", hang, { timeoutMs: 500 });
  assert.equal(r.pass, false);
  assert.equal(r.timedOut, true);
  assert.equal(exitCodeForResults([r]), 1);
});

test("10. successful synthetic run → zero exit", () => {
  const dir = tmpDir();
  const artifact = path.join(dir, "manifest.md");
  fs.writeFileSync(artifact, "ok", "utf8");
  const results = [
    runStepCore("a", "typecheck", okCmd),
    runStepCore("b", "build", okCmd, { productionNodeEnv: true }),
    runStepCore("c", "manifest", okCmd, { cwd: dir, requiredArtifact: artifact }),
  ];
  assert.equal(exitCodeForResults(results), 0);
  assert.match(finalBanner(true, true), /LOCAL GATES: PASS/);
});

console.log(`\nrc-orchestrator-behavior: ${passed}/10 PASS`);
if (passed !== 10) process.exit(1);
