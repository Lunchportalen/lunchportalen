#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  detectRequiredCheckScopeFromChanged,
  isCheckPathTouched,
} from "./detect-required-check-scope.mjs";
import {
  REQUIRED_CHECK_PATH_CONFIG,
  SUPABASE_MIGRATE_CI_PATHS,
} from "./required-check-path-patterns.mjs";

assert.equal(
  isCheckPathTouched(["lib/demo/leads.ts"], REQUIRED_CHECK_PATH_CONFIG.build.paths),
  true,
);
assert.equal(
  isCheckPathTouched(["lib/demo/leads.ts"], REQUIRED_CHECK_PATH_CONFIG.week_visual.paths),
  false,
);
assert.equal(
  isCheckPathTouched(["lib/demo/leads.ts"], REQUIRED_CHECK_PATH_CONFIG.provider_meny_visual.paths),
  false,
);
assert.equal(
  isCheckPathTouched(
    ["app/leverandor/meny/page.tsx"],
    REQUIRED_CHECK_PATH_CONFIG.provider_meny_visual.paths,
  ),
  true,
);
assert.equal(
  isCheckPathTouched(
    ["app/(app)/week/page.tsx"],
    REQUIRED_CHECK_PATH_CONFIG.week_visual.paths,
  ),
  true,
);
assert.equal(
  isCheckPathTouched(
    ["components/providers/ProviderMenyEditorShell.tsx"],
    REQUIRED_CHECK_PATH_CONFIG.provider_meny_visual.paths,
  ),
  true,
);
assert.equal(isCheckPathTouched(["docs/foo.md"], REQUIRED_CHECK_PATH_CONFIG.build.paths), false);
assert.equal(
  isCheckPathTouched(["umbraco17/foo.cs"], REQUIRED_CHECK_PATH_CONFIG.build.paths),
  false,
);

// staging: migration/schema scope only — app/lib PRs get passthrough green
assert.equal(
  isCheckPathTouched(["lib/demo/leads.ts"], SUPABASE_MIGRATE_CI_PATHS),
  false,
);
assert.equal(
  isCheckPathTouched(["app/(app)/week/page.tsx"], SUPABASE_MIGRATE_CI_PATHS),
  false,
);
assert.equal(
  isCheckPathTouched([".github/workflows/ci.yml"], SUPABASE_MIGRATE_CI_PATHS),
  false,
);
assert.equal(
  isCheckPathTouched(
    ["supabase/migrations/20260716120000_foo.sql"],
    SUPABASE_MIGRATE_CI_PATHS,
  ),
  true,
);
assert.equal(
  isCheckPathTouched(["scripts/ci/migration-gate.mjs"], SUPABASE_MIGRATE_CI_PATHS),
  true,
);
assert.deepEqual(REQUIRED_CHECK_PATH_CONFIG.staging.paths, SUPABASE_MIGRATE_CI_PATHS);

const synthetic = detectRequiredCheckScopeFromChanged(["lib/demo/leads.ts", "docs/foo.md"]);
assert.equal(synthetic.build.touched, true);
assert.equal(synthetic.week_visual.touched, false);
assert.equal(synthetic.provider_meny_visual.touched, false);
assert.equal(synthetic.staging.touched, false);

const migrationPr = detectRequiredCheckScopeFromChanged([
  "supabase/migrations/20260716120000_foo.sql",
]);
assert.equal(migrationPr.staging.touched, true);
assert.equal(migrationPr.build.touched, true);

const ciOnlyPr = detectRequiredCheckScopeFromChanged(["scripts/ci/migration-gate.mjs"]);
assert.equal(ciOnlyPr.staging.touched, true);
assert.equal(ciOnlyPr.build.touched, true);

console.log(JSON.stringify({ ok: true, module: "detect-required-check-scope" }, null, 2));
