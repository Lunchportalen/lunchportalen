#!/usr/bin/env node
import assert from "node:assert/strict";

import {
  COMMERCIAL_HARDCODE_PATTERNS,
  runCommercialHardcodesGuard,
  scanCommercialHardcodes,
} from "./commercial-hardcodes-guard.mjs";

assert.ok(COMMERCIAL_HARDCODE_PATTERNS.length >= 10);

const found = scanCommercialHardcodes();
assert.ok(found.length > 0, "expected at least one allowlisted commercial hardcode in app/lib/components");

const check = runCommercialHardcodesGuard();
assert.equal(check.ok, true, `unexpected hardcodes: ${check.unexpected.join(", ")}`);
assert.equal(check.unexpected.length, 0);
assert.ok(check.count >= check.allowlistedCount);

console.log("✅ commercial-hardcodes-guard.test.mjs OK");
