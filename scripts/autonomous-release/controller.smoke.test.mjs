import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

function classifyFromText(blob) {
  const s = String(blob || "");
  if (
    /PHASE18_POOLER_AUTH_PROBE_FAILED|phase18_pooler_probe_retry|timeout expired|ECONNRESET|ECONNREFUSED|pooler/i.test(
      s,
    )
  ) {
    return "NETWORK_OR_POOLER_ERROR";
  }
  if (/api-keys HTTP|project HTTP|PHASE18_PROJECT_NOT_FOUND|project not found|INACTIVE|RESOURCE_EXPIR|paused/i.test(s)) {
    return "RESOURCE_EXPIRATION";
  }
  if (/\bSECURITY_INCIDENT\b|secret.?expos(?:ed|ure)|critical security finding/i.test(s)) {
    return "SECURITY_INCIDENT";
  }
  if (/rate limit|AUTH_RATE_LIMIT|429/i.test(s)) return "RATE_LIMIT_ERROR";
  if (/AUTH_REFRESH_FAIL/i.test(s)) return "AUTH_OR_SESSION_ERROR";
  return "TEST_HARNESS_ERROR";
}

assert.equal(
  classifyFromText("PHASE18_POOLER_AUTH_PROBE_FAILED: timeout expired"),
  "NETWORK_OR_POOLER_ERROR",
);
assert.equal(classifyFromText("api-keys HTTP 400"), "RESOURCE_EXPIRATION");
assert.equal(classifyFromText("PHASE18_PROJECT_NOT_FOUND: api-keys HTTP 400"), "RESOURCE_EXPIRATION");
assert.equal(classifyFromText("PHASE18_AUTH_REFRESH_FAIL cycle=1"), "AUTH_OR_SESSION_ERROR");
assert.equal(
  classifyFromText("secret scan\nPHASE18_POOLER_AUTH_PROBE_FAILED: timeout expired"),
  "NETWORK_OR_POOLER_ERROR",
);

const wf = fs.readFileSync(path.join(ROOT, ".github/workflows/phase18-autonomous-controller.yml"), "utf8");
assert.match(wf, /\*\/5 \* \* \* \*/);
assert.match(wf, /phase18scale-load-cert/);
assert.match(wf, /types:\s*\[completed\]/);
assert.match(wf, /ref: main/);
assert.match(wf, /actions: write/);

const af = fs.readFileSync(path.join(ROOT, ".github/workflows/phase18-autonomous-autofix.yml"), "utf8");
assert.match(af, /phase18-autonomous-autofix/);
assert.match(af, /Overlay autofix scripts from main/);

const ctrl = fs.readFileSync(path.join(ROOT, "scripts/autonomous-release/controller.mjs"), "utf8");
assert.match(ctrl, /wasRunHandled/);
assert.match(ctrl, /autofix_then_redispatch_phase18|dispatch_replacement_phase18|waitForNewAutofixRun/);
assert.match(ctrl, /CONTROLLER_MAX_REACTION_TIME|5m schedule|in-tick autofix wait/);

const require = createRequire(import.meta.url);
assert.ok(require("fs").existsSync(path.join(ROOT, ".github/workflows/phase18-autonomous-controller.yml")));
assert.ok(require("fs").existsSync(path.join(ROOT, ".github/workflows/phase18-autonomous-autofix.yml")));
console.log("controller.smoke.test.mjs: PASS");
