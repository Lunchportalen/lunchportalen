#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  pathMatchesAnyGitHubFilter,
  pathMatchesGitHubFilter,
} from "./github-path-filter.mjs";

assert.equal(pathMatchesGitHubFilter("lib/demo/leads.ts", "lib/**"), true);
assert.equal(pathMatchesGitHubFilter("app/(app)/week/page.tsx", "app/(app)/week/**"), true);
assert.equal(pathMatchesGitHubFilter("middleware.ts", "middleware.ts"), true);
assert.equal(pathMatchesGitHubFilter("src/middleware.ts", "middleware.ts"), false);
assert.equal(pathMatchesGitHubFilter("eslint.config.mjs", "eslint.config.*"), true);
assert.equal(
  pathMatchesGitHubFilter(
    "e2e/week-visual-regression.e2e.ts-snapshots/linux/foo.png",
    "e2e/week-visual-regression.e2e.ts-snapshots/**",
  ),
  true,
);
assert.equal(pathMatchesAnyGitHubFilter("docs/foo.md", ["app/**", "lib/**"]), false);

console.log(JSON.stringify({ ok: true, module: "github-path-filter" }, null, 2));
