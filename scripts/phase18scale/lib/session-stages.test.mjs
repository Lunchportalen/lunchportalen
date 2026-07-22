#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  SESSION_STAGE_TARGETS,
  resolveSessionStage,
  sessionTargetForStage,
} from "./session-stages.mjs";

assert.equal(SESSION_STAGE_TARGETS["smoke-100"], 100);
assert.equal(SESSION_STAGE_TARGETS["smoke-500"], 500);
assert.equal(SESSION_STAGE_TARGETS["ramp-1000"], 1000);
assert.equal(SESSION_STAGE_TARGETS["ramp-5000"], 5000);
assert.equal(SESSION_STAGE_TARGETS["ramp-10000"], 10000);

assert.equal(resolveSessionStage({ PHASE18_HTTP_WAVE: "100" }), "smoke-100");
assert.equal(resolveSessionStage({ PHASE18_SESSION_STAGE: "ramp-5000" }), "ramp-5000");
assert.equal(sessionTargetForStage("smoke-100", {}), 100);
assert.equal(sessionTargetForStage("smoke-100", { PHASE18_SESSION_TARGET: "120" }), 120);

console.log(JSON.stringify({ session_stages_tests: "PASS" }));
