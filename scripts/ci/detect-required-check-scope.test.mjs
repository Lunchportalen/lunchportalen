#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  detectRequiredCheckScopeFromChanged,
  isCheckPathTouched,
} from "./detect-required-check-scope.mjs";
import { REQUIRED_CHECK_PATH_CONFIG } from "./required-check-path-patterns.mjs";

assert.equal(
  isCheckPathTouched(["lib/demo/leads.ts"], REQUIRED_CHECK_PATH_CONFIG.build.paths),
  true,
);
assert.equal(
  isCheckPathTouched(["lib/demo/leads.ts"], REQUIRED_CHECK_PATH_CONFIG.week_visual.paths),
  false,
);
assert.equal(
  isCheckPathTouched(
    ["app/(app)/week/page.tsx"],
    REQUIRED_CHECK_PATH_CONFIG.week_visual.paths,
  ),
  true,
);
assert.equal(isCheckPathTouched(["docs/foo.md"], REQUIRED_CHECK_PATH_CONFIG.build.paths), false);
assert.equal(
  isCheckPathTouched(["umbraco17/foo.cs"], REQUIRED_CHECK_PATH_CONFIG.build.paths),
  false,
);

const synthetic = detectRequiredCheckScopeFromChanged(["lib/demo/leads.ts", "docs/foo.md"]);
assert.equal(synthetic.build.touched, true);
assert.equal(synthetic.week_visual.touched, false);

console.log(JSON.stringify({ ok: true, module: "detect-required-check-scope" }, null, 2));
