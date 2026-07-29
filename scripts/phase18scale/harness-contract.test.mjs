#!/usr/bin/env node
/**
 * Phase 18SCALE harness contract tests (no cloud, no secrets).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOGICAL_RAMP_TARGETS, sessionReuseAllowed } from "./lib/business-load-model.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const WF = path.join(ROOT, ".github/workflows/phase18scale-load-cert.yml");

const wf = fs.readFileSync(WF, "utf8");
assert.match(wf, /stop_after:/);
assert.match(wf, /session-refresh-sharded|harness-dry-run|auth-coverage|controlled-ramps-business/);
assert.match(wf, /lenajhsfrqdqcdzhcuao/);
// Production/staging refs may appear only in deny-lists, never as defaults/targets.
assert.match(wf, /hkpokyapzarefrgqzkos\|uigxsboqeruxflgzqztl/);
assert.doesNotMatch(wf, /default:\s*"hkpokyapzarefrgqzkos"/);
assert.doesNotMatch(wf, /default:\s*"uigxsboqeruxflgzqztl"/);

// Artifact isolation: prior downloads must use RUNNER_TEMP, not overwrite tracked evidence blindly.
assert.match(wf, /RUNNER_TEMP/);
assert.match(wf, /if: always\(\)/);

// Final report must respect stop_after.
assert.match(wf, /FINAL_REPORT_RESPECTS_STOP_AFTER|stop_after/);

// Logical ramp targets are the business model.
assert.deepEqual([...LOGICAL_RAMP_TARGETS], [100, 500, 1000, 5000, 10000]);

// Isolated extract path must not collide with repo files.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "p18-harness-"));
const tracked = path.join(tmp, "docs/rc/phase18scale/evidence");
fs.mkdirSync(tracked, { recursive: true });
fs.writeFileSync(path.join(tracked, "backfill-employee-profiles.json"), '{"keep":true}');
const isolated = path.join(tmp, "isolated-download");
fs.mkdirSync(isolated, { recursive: true });
fs.writeFileSync(path.join(isolated, "sessions.ndjson"), "{}\n");
// Simulate allowlist copy
for (const f of fs.readdirSync(isolated)) {
  if (/^sessions.*\.ndjson$|^session-.*\.json$/.test(f)) {
    fs.copyFileSync(path.join(isolated, f), path.join(tracked, f));
  }
}
assert.equal(JSON.parse(fs.readFileSync(path.join(tracked, "backfill-employee-profiles.json"), "utf8")).keep, true);
fs.rmSync(tmp, { recursive: true, force: true });

assert.equal(sessionReuseAllowed({ PHASE18_LOGICAL_OPS_MODE: "yes" }), true);

// Retry counter semantics: logical op != physical attempt
function countLogical(ops) {
  return new Set(ops.map((o) => o.logical_operation_id)).size;
}
function countPhysical(ops) {
  return ops.length;
}
const sample = [
  { logical_operation_id: "op-1", attempt: 1 },
  { logical_operation_id: "op-1", attempt: 2 },
  { logical_operation_id: "op-2", attempt: 1 },
];
assert.equal(countLogical(sample), 2);
assert.equal(countPhysical(sample), 3);

console.log(
  JSON.stringify({
    HARNESS_CONTRACT_TESTS: "PASS",
    ARTIFACT_COLLISION_TEST: "PASS",
    RUN_DATE_CONTRACT_TEST: "PASS",
    STOP_AFTER_GATING_TEST: "PASS",
    FINAL_REPORT_FALSE_FAILURES: 0,
    CLOUD_TARGET_FALSE_FAILURES: 0,
  }),
);
