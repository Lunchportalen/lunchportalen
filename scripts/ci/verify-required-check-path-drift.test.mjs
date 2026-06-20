#!/usr/bin/env node
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { verifyRequiredCheckPathDrift } from "./verify-required-check-path-drift.mjs";
import { SUPABASE_MIGRATE_CI_PATHS } from "./required-check-path-patterns.mjs";

const root = resolve(import.meta.dirname, "../..");
const result = verifyRequiredCheckPathDrift({ cwd: root });

assert.equal(result.ok, true, JSON.stringify(result.mismatches, null, 2));

const stagingMismatch = result.mismatches?.find((m) => m.check === "staging");
assert.equal(stagingMismatch, undefined);

// Canonical staging paths must match workflow lockstep export
assert.equal(
  result.ok,
  true,
  "SUPABASE_MIGRATE_CI_PATHS must stay identical to supabase-migrate.yml on.pull_request.paths",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      staging_path_count: SUPABASE_MIGRATE_CI_PATHS.length,
      checks_verified: Object.keys(result.mismatches ?? {}).length === 0,
    },
    null,
    2,
  ),
);
