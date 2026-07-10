/** @typedef {'read-only' | 'production'} GoOperatorMode */

export const GO_OPERATOR_VERSION = "1.0.0";

export const VALID_TASKS = [
  "truth-freeze",
  "f4b-readiness",
  "f4b-production-apply-readiness",
  "sot-dry-run",
  "evidence-pr",
];

/** @type {Record<string, string>} */
export const TASK_ALIASES = {
  "f4b-apply-readiness": "f4b-production-apply-readiness",
};

export const EXPECTED_REMOTE = "https://github.com/Lunchportalen/lunchportalen.git";

export const F4B_MIGRATION = "20260810120000";
export const F4B_MIGRATION_FILE =
  "supabase/migrations/20260810120000_msdi_localized_sot_snapshot_trigger_alignment.sql";

export const TRUTH_INDEX = "docs/evidence/go-truth-state-reconciliation-2026-07-10.md";

/** Operations always forbidden in this operator — even with allow_production_mutation=true */
export const ALWAYS_FORBIDDEN_OPERATIONS = [
  "sot_start",
  "sot_cutover",
  "auto_rollout",
  "supabase_apply",
  "supabase_db_push",
  "vercel_env_change",
  "sanity_mutation",
  "billing_stripe",
  "order_write_path",
  "lp_order_set_mutation",
  "generator_apply",
  "onboarding_apply",
  "phase_d_apply",
  "publish",
];

export const SECRET_SCAN_PATTERNS = [
  /password\s*[:=]\s*['"][^'"]{8,}/i,
  /service_role\s*[:=]\s*['"][^'"]+/i,
  /SUPABASE_SERVICE_ROLE\s*[:=]\s*['"][^'"]+/i,
  /SANITY_AUTH_TOKEN\s*[:=]\s*['"][^'"]+/i,
  /PROVIDER_ADMIN_PASSWORD\s*[:=]\s*['"][^'"]+/i,
  /\bsk_(live|test)_[A-Za-z0-9]{16,}/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./,
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
];

export const DOCS_ONLY_ALLOWED_PREFIXES = ["docs/"];

/** Last verified production migration ledger snapshot (read-only reference). */
export const PRODUCTION_LEDGER_SNAPSHOT = [
  "20260528000000",
  "20260529120000",
  "20260530120000",
  "20260530123000",
  "20260531120000",
  "20260601120000",
  "20260602120000",
  "20260603120000",
  "20260603120100",
  "20260604120000",
  "20260605120000",
  "20260606120000",
  "20260607120000",
  "20260608120000",
  "20260609120000",
  "20260609130000",
  "20260609150000",
  "20260610120000",
  "20260610130000",
  "20260611120000",
  "20260612120000",
  "20260615120000",
  "20260616110410",
  "20260616120000",
  "20260617120000",
  "20260618120000",
  "20260620183000",
  "20260630120000",
  "20260701120000",
  "20260702120000",
  "20260703120000",
  "20260707120000",
  "20260708120000",
  "20260709120000",
  "20260710120000",
  "20260711120000",
  "20260713120000",
  "20260714120000",
  "20260715120000",
  "20260716120000",
  "20260718120000",
  "20260722120000",
  "20260723120000",
  "20260724120000",
  "20260725120000",
  "20260726120000",
  "20260727120000",
  "20260728120000",
  "20260810120000",
];

/** Repo migrations not yet in production ledger snapshot (billing track). */
export const PENDING_BILLING_MIGRATIONS = [
  "20260729120000",
  "20260730120000",
  "20260731120000",
  "20260801120000",
  "20260802120000",
  "20260803120000",
  "20260804120000",
  "20260805120000",
  "20260806120000",
  "20260807120000",
  "20260808120000",
  "20260809120000",
];

export const TASK_TEST_COMMANDS = {
  "truth-freeze": [
    "npm run test:golden-path",
    "npx vitest run tests/lib/i18n/localeRegistry.test.ts tests/lib/provider-onboarding/phaseDLocales.test.ts --config vitest.config.ts",
  ],
  "f4b-readiness": [
    "npx vitest run tests/lib/menu-publish/msdiLocalizedSotSnapshotTriggerMigration.test.ts tests/lib/menu-publish/msdiSnapshotMode.test.ts tests/sync-menu-service-day-items.test.ts --config vitest.config.ts",
  ],
  "f4b-production-apply-readiness": [
    "npx vitest run tests/lib/menu-publish/msdiLocalizedSotSnapshotTriggerMigration.test.ts tests/lib/menu-publish/msdiSnapshotMode.test.ts tests/sync-menu-service-day-items.test.ts --config vitest.config.ts",
  ],
  "sot-dry-run": [
    "npx vitest run tests/lib/menu-generator/localizedGeneratorSotResolver.test.ts tests/lib/menu-generator/sotMsdiItemMapping.test.ts --config vitest.config.ts",
  ],
  "evidence-pr": [],
};
