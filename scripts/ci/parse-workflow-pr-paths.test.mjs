#!/usr/bin/env node
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { loadWorkflowPullRequestPaths } from "./parse-workflow-pr-paths.mjs";
import { REQUIRED_CHECK_PATH_CONFIG } from "./required-check-path-patterns.mjs";
import { pathListsEqual } from "./verify-required-check-path-drift.mjs";

const root = resolve(import.meta.dirname, "../..");

for (const [checkKey, config] of Object.entries(REQUIRED_CHECK_PATH_CONFIG)) {
  const parsed = loadWorkflowPullRequestPaths(config.workflow, { cwd: root });
  assert.ok(parsed.length > 0, `${checkKey}: empty parsed paths`);
  assert.equal(
    pathListsEqual(parsed, config.paths),
    true,
    `${checkKey}: parser vs passthrough registry drift`,
  );
}

console.log(
  JSON.stringify({ ok: true, checks: Object.keys(REQUIRED_CHECK_PATH_CONFIG).length }, null, 2),
);
