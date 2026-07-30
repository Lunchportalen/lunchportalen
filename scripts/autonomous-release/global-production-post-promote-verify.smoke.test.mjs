#!/usr/bin/env node
/**
 * Regression: post-promote integrity SQL must not query orders.country_code
 * (production orders has no such column — run 30566368300 fatal).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const SRC = fs.readFileSync(
  path.join(ROOT, "scripts/autonomous-release/global-production-post-promote-verify.mjs"),
  "utf8",
);

assert.match(SRC, /GLOBAL_PRODUCTION_POST_PROMOTE_VERIFY/);
assert.match(SRC, /waitForHealthSha/);
assert.match(SRC, /POST_PROMOTE_HEALTH_FETCH_TRANSIENT/);

// Exact defect from run 30566368300: integrity probe used orders.country_code.
assert.doesNotMatch(
  SRC,
  /from public\.orders where coalesce\(country_code/i,
  "must not query public.orders.country_code",
);
assert.doesNotMatch(
  SRC,
  /orders\.country_code/i,
  "must not reference orders.country_code",
);

// Integrity checks remain present (not weakened away).
assert.match(SRC, /rls_policy_count/);
assert.match(SRC, /cancelled_orders_count/);
assert.match(SRC, /commission_ledger_count/);
assert.match(SRC, /orders_status_readable/);
assert.match(SRC, /status = 'CANCELLED'/);

// country_code remains valid on country_production_activation.
assert.match(SRC, /from public\.country_production_activation/);

const ctrl = fs.readFileSync(
  path.join(ROOT, "scripts/autonomous-release/controller.mjs"),
  "utf8",
);
assert.match(ctrl, /POST_PROMOTE_VERIFY_WORKFLOW|global-production-post-promote-verify\.yml/);
assert.match(ctrl, /reactToPostPromoteVerifyFailure|post_promote_verify/);

console.log("global-production-post-promote-verify.smoke.test.mjs: PASS");
