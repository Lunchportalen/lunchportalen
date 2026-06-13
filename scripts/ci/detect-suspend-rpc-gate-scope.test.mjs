#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  detectSuspendRpcGateScope,
  isSuspendRpcGateRelevant,
} from "./detect-suspend-rpc-gate-scope.mjs";

assert.equal(isSuspendRpcGateRelevant(["components/Foo.tsx"]), false);
assert.equal(isSuspendRpcGateRelevant(["supabase/migrations/x.sql"]), true);
assert.equal(isSuspendRpcGateRelevant(["lib/admin/companies.ts"]), true);
assert.equal(
  isSuspendRpcGateRelevant(["tests/db/suspend-rpc.test.ts", "scripts/ci/run-suspend-rpc-integration.mjs"]),
  false,
);

const pos = detectSuspendRpcGateScope("origin/main", "HEAD", { fetch: false });
assert.equal(typeof pos.relevant, "boolean");

console.log(JSON.stringify({ ok: true, local_relevant: pos.relevant, changed: pos.changed.length }, null, 2));
