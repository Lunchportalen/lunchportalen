#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  PROTECTED_GUARD_EXEMPT_PREFIXES,
  detectProtectedGoldenPathChanges,
  evaluateProtectedPathGuard,
  isProtectedGoldenPathFile,
  isProtectedGoldenPathTestFile,
  PR_BODY_MARKER,
} from "./guard-protected-golden-path.mjs";

assert.equal(isProtectedGoldenPathFile("app/api/orders/route.ts"), true);
assert.equal(isProtectedGoldenPathFile("app/api/week/route.ts"), true);
assert.equal(isProtectedGoldenPathFile("lib/orders/rpcWrite.ts"), true);
assert.equal(
  isProtectedGoldenPathFile("supabase/migrations/20260611120000_lp_order_set_variant_itemkey.sql"),
  true,
);
assert.equal(isProtectedGoldenPathFile("lib/providers/loadKitchenOrders.ts"), true);
assert.equal(isProtectedGoldenPathFile("lib/providers/providerOrderEnrichment.ts"), true);
assert.equal(isProtectedGoldenPathFile("lib/providers/kitchenOrderStatus.ts"), true);
assert.equal(isProtectedGoldenPathFile("lib/admin/orderStatus.ts"), true);
assert.equal(isProtectedGoldenPathFile("components/week/WeekHero.tsx"), false);
assert.equal(isProtectedGoldenPathFile("components/providers/CustomerList.tsx"), false);

for (const exempt of PROTECTED_GUARD_EXEMPT_PREFIXES) {
  assert.equal(isProtectedGoldenPathFile(exempt), false, `exempt: ${exempt}`);
}

assert.equal(isProtectedGoldenPathTestFile("tests/governance/protected-golden-path.test.ts"), true);
assert.equal(isProtectedGoldenPathTestFile("tests/api/orders-idempotency.test.ts"), true);
assert.equal(isProtectedGoldenPathTestFile("tests/providers/providerProductionStatusFlow.test.ts"), true);
assert.equal(isProtectedGoldenPathTestFile("tests/components/week-category-card.test.tsx"), false);

const passNoTouch = evaluateProtectedPathGuard({
  protectedFiles: [],
  protectedTestsChanged: [],
});
assert.equal(passNoTouch.ok, true);

const failMissing = evaluateProtectedPathGuard({
  protectedFiles: ["app/api/orders/route.ts"],
  protectedTestsChanged: [],
  prBody: "ordinary change",
});
assert.equal(failMissing.ok, false);

const passBody = evaluateProtectedPathGuard({
  protectedFiles: ["lib/orders/rpcWrite.ts"],
  protectedTestsChanged: [],
  prBody: `## Summary\n${PR_BODY_MARKER}\nAudit done.`,
});
assert.equal(passBody.ok, true);

const passTests = evaluateProtectedPathGuard({
  protectedFiles: ["app/api/week/route.ts"],
  protectedTestsChanged: ["tests/api/week-profile-lookup.test.ts"],
});
assert.equal(passTests.ok, true);

const passLabel = evaluateProtectedPathGuard({
  protectedFiles: ["lib/orders/orderWriteGuard.ts"],
  protectedTestsChanged: [],
  labels: ["protected-path-approved"],
});
assert.equal(passLabel.ok, true);

// Self-diff on main should not flag governance-only files as sensitive.
let mainSha = null;
try {
  mainSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
} catch {
  // not a git repo in some sandboxes
}

if (mainSha) {
  const self = detectProtectedGoldenPathChanges(mainSha, mainSha, { fetch: false });
  assert.equal(self.protected.length, 0, "no protected delta on identical SHAs");
}

console.log(JSON.stringify({ ok: true, marker: PR_BODY_MARKER }, null, 2));
