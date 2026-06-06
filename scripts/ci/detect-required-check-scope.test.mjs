#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  detectRequiredCheckScope,
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

const live = detectRequiredCheckScope("origin/main", "HEAD", { fetch: false });
assert.equal(typeof live.build.touched, "boolean");
assert.equal(typeof live.week_visual.touched, "boolean");

console.log(
  JSON.stringify(
    {
      ok: true,
      local_build_touched: live.build.touched,
      local_week_visual_touched: live.week_visual.touched,
    },
    null,
    2,
  ),
);
