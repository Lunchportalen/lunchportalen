import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Lightweight smoke: classifier + fingerprint helpers via subprocess-free reimplementation.
function classifyFromText(blob) {
  const s = String(blob || "");
  if (/PHASE18_POOLER_AUTH_PROBE_FAILED|timeout expired/i.test(s)) return "NETWORK_OR_POOLER_ERROR";
  if (/rate limit|AUTH_RATE_LIMIT/i.test(s)) return "RATE_LIMIT_ERROR";
  if (/AUTH_REFRESH_FAIL/i.test(s)) return "AUTH_OR_SESSION_ERROR";
  return "TEST_HARNESS_ERROR";
}

assert.equal(
  classifyFromText("PHASE18_POOLER_AUTH_PROBE_FAILED: timeout expired"),
  "NETWORK_OR_POOLER_ERROR",
);
assert.equal(
  classifyFromText("secret scan\nPHASE18_POOLER_AUTH_PROBE_FAILED: timeout expired"),
  "NETWORK_OR_POOLER_ERROR",
);
assert.equal(classifyFromText("PHASE18_AUTH_REFRESH_FAIL cycle=1"), "AUTH_OR_SESSION_ERROR");
assert.equal(classifyFromText("AUTH_RATE_LIMIT pause"), "RATE_LIMIT_ERROR");
assert.equal(
  classifyFromText("PHASE18_ALLOW_PROVISION: YES\n##[error]Process completed with exit code 2."),
  "TEST_HARNESS_ERROR",
);
{
  const blob = [
    "PHASE18_ALLOW_PROVISION: YES",
    ' {"phase18_pooler_probe_retry":{"error":"timeout expired"}}',
    "PHASE18_POOLER_AUTH_PROBE_FAILED: timeout expired",
    "##[error]Process completed with exit code 2.",
  ].join("\n");
  const m = blob.match(/PHASE18_[A-Z0-9_]*FAIL[A-Z0-9_]*[^\n]*/i);
  assert.ok(m && /POOLER_AUTH_PROBE_FAILED/.test(m[0]));
  assert.equal(classifyFromText(m[0]), "NETWORK_OR_POOLER_ERROR");
}

const require = createRequire(import.meta.url);
assert.ok(require("fs").existsSync(new URL("../../.github/workflows/phase18-autonomous-controller.yml", import.meta.url)));
assert.ok(require("fs").existsSync(new URL("../../.github/workflows/phase18-autonomous-autofix.yml", import.meta.url)));
console.log("controller.smoke.test.mjs: PASS");
