import assert from "node:assert/strict";
import { assertPhase18ApiTarget, isLoadCertMode } from "./cloud-api-target.mjs";

const loadEnv = {
  PHASE18_LOADCERT: "1",
  PHASE18_LOAD_REF: "lenajhsfrqdqcdzhcuao",
};

assert.equal(isLoadCertMode(loadEnv), true);

const cloud = assertPhase18ApiTarget(
  "https://lenajhsfrqdqcdzhcuao.supabase.co",
  loadEnv,
);
assert.equal(cloud.mode, "cloud");
assert.equal(cloud.ref, "lenajhsfrqdqcdzhcuao");

assert.throws(
  () => assertPhase18ApiTarget("http://127.0.0.1:54321", loadEnv),
  /CLOUD_API_TARGET_LOCALHOST_FORBIDDEN/,
);
assert.throws(
  () =>
    assertPhase18ApiTarget("https://hkpokyapzarefrgqzkos.supabase.co", loadEnv),
  /PRODUCTION_API_TARGET_FORBIDDEN/,
);
assert.throws(
  () =>
    assertPhase18ApiTarget("https://uigxsboqeruxflgzqztl.supabase.co", {
      ...loadEnv,
      PHASE18_LOAD_REF: "lenajhsfrqdqcdzhcuao",
    }),
  /SHARED_STAGING_API_TARGET_FORBIDDEN/,
);

const local = assertPhase18ApiTarget("http://127.0.0.1:54321", {
  PHASE18_LOADCERT: "0",
});
assert.equal(local.mode, "local");

console.log("cloud-api-target.test.mjs PASS");
