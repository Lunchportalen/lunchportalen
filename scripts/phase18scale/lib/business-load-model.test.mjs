#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  ACTIVE_LOAD_SESSIONS_TARGET,
  AUTH_REFRESH_COVERAGE_SESSIONS,
  LOGICAL_RAMP_TARGETS,
  maxOpsPerSessionForWave,
  resolveLogicalRampStage,
  sessionReuseAllowed,
  certificationStatusDefaults,
} from "./business-load-model.mjs";

assert.equal(ACTIVE_LOAD_SESSIONS_TARGET, 5000);
assert.equal(AUTH_REFRESH_COVERAGE_SESSIONS, 2000);
assert.deepEqual([...LOGICAL_RAMP_TARGETS], [100, 500, 1000, 5000, 10000]);
assert.equal(maxOpsPerSessionForWave(10000, 5000), 2);
assert.equal(maxOpsPerSessionForWave(100000, 5000), 20);
assert.equal(resolveLogicalRampStage({ PHASE18_HTTP_WAVE: "1000" }), 1000);
assert.equal(sessionReuseAllowed({ PHASE18_LOGICAL_OPS_MODE: "1" }), true);
assert.equal(sessionReuseAllowed({}), false);
const st = certificationStatusDefaults();
assert.equal(st.GLOBAL_SCALE_CERTIFIED, "NO");
assert.equal(st.AUTH_SESSION_COVERAGE_CERTIFIED, "NO");
console.log(JSON.stringify({ business_load_model_tests: "PASS" }));
