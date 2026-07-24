#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  classifyRefreshError,
  deriveStageManifestsFromCanonical,
  hashTokenFingerprint,
  redactIdentity,
  toCanonicalRecord,
  writeCanonicalStore,
} from "./canonical-session-store.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "p18-canonical-"));
const rows = [];
for (let i = 0; i < 10000; i += 1) {
  rows.push(
    toCanonicalRecord({
      index: i,
      email: `p18scale-emp-${String(i).padStart(5, "0")}@load.lunchportalen.test`,
      user_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      company_id: `co-${i % 50}`,
      location_id: `loc-${i % 50}`,
      provider_id: `prov-${i % 10}`,
      package: i % 3 === 0 ? "LUXUS" : "BASIS",
      access_token: `hdr.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.sig`,
      refresh_token: `refresh-token-value-${i}-xxxxxxxxxxxxxxxxxxxx`,
      shard: Math.floor(i / 1000),
      issued_at: new Date().toISOString(),
    }),
  );
}

const report = writeCanonicalStore(tmp, rows, { test: true });
assert.equal(report.CANONICAL_SESSION_ROWS, 10000);
assert.equal(report.CANONICAL_UNIQUE_USERS, 10000);
assert.equal(report.CANONICAL_DUPLICATE_USERS, 0);

const derived = deriveStageManifestsFromCanonical(tmp, rows);
assert.equal(derived["smoke-100"].SESSION_ROWS, 100);
assert.equal(derived["smoke-500"].SESSION_ROWS, 500);
assert.equal(derived["ramp-1000"].SESSION_ROWS, 1000);
assert.equal(derived["ramp-5000"].SESSION_ROWS, 5000);
assert.equal(derived["ramp-10000"].SESSION_ROWS, 10000);
assert.equal(derived["smoke-100"].SESSION_WRAP, false);

assert.equal(classifyRefreshError({ message: "Request rate limit reached" }), "AUTH_RATE_LIMIT");
assert.equal(classifyRefreshError({ message: "Invalid Refresh Token: Already Used" }), "REFRESH_TOKEN_ALREADY_USED");
assert.ok(redactIdentity("p18scale-emp-34@load.lunchportalen.test").startsWith("emp-34:"));
assert.equal(hashTokenFingerprint("abc").length, 24);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify({ canonical_session_store_tests: "PASS" }));
