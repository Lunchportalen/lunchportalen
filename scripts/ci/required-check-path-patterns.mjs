#!/usr/bin/env node
/**
 * Passthrough path filters per required check — must stay identical to each
 * workflow's on.pull_request.paths (enforced by verify-required-check-path-drift.mjs).
 *
 * SUPABASE_MIGRATE_CI_PATHS is the canonical migration/schema scope for staging
 * (supabase-migrate workflow triggers + passthrough detect — keep in lockstep).
 */

/** @typedef {{ workflow: string, paths: string[] }} RequiredCheckPathConfig */

/**
 * Canonical path set for supabase-migrate.yml (PR + push path filters) and staging passthrough.
 * Only migration/schema scope + CI scripts the migrate workflow actually invokes.
 */
export const SUPABASE_MIGRATE_CI_PATHS = [
  "supabase/migrations/**",
  "supabase/config.toml",
  ".github/workflows/supabase-migrate.yml",
  "scripts/ci/detect-pr-migration-changes.mjs",
  "scripts/ci/migration-gate.mjs",
  "scripts/ci/db-contracts.mjs",
  "scripts/ci/assert-db-target.mjs",
  "scripts/ci/db-push-preflight-guard.mjs",
  "scripts/ci/repair-staging-mcp-batch-ledger.mjs",
  "scripts/ci/repair-staging-provider-cutoff-ledger.mjs",
  "scripts/ci/repair-staging-menu-week-opening-ledger.mjs",
  "scripts/ci/verify-batch-order-status-sync-staging.mjs",
  "scripts/ci/verify-fundament-spine-phase2-auth-hook.mjs",
  "scripts/smoke/run-cron-smoke-ci.sh",
  "scripts/smoke/cron-smoke.sh",
];

/** @type {Record<string, RequiredCheckPathConfig>} */
export const REQUIRED_CHECK_PATH_CONFIG = {
  build: {
    workflow: ".github/workflows/ci.yml",
    paths: [
      "app/**",
      "components/**",
      "lib/**",
      "public/**",
      "studio/**",
      "supabase/**",
      "scripts/**",
      "tests/**",
      "e2e/**",
      "middleware.ts",
      "next.config.ts",
      "instrumentation.ts",
      "vercel.json",
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "vitest.config.ts",
      "playwright.config.ts",
      "tailwind.config.cjs",
      "postcss.config.cjs",
      ".eslintrc.cjs",
      "eslint.config.*",
      "AGENTS.md",
      ".github/workflows/ci.yml",
    ],
  },
  enterprise: {
    workflow: ".github/workflows/ci-enterprise.yml",
    paths: [
      "app/**",
      "components/**",
      "lib/**",
      "public/**",
      "studio/**",
      "supabase/**",
      "scripts/**",
      "tests/**",
      "e2e/**",
      "middleware.ts",
      "next.config.ts",
      "instrumentation.ts",
      "vercel.json",
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "vitest.config.ts",
      "playwright.config.ts",
      "tailwind.config.cjs",
      "postcss.config.cjs",
      ".eslintrc.cjs",
      "eslint.config.*",
      "AGENTS.md",
      ".github/workflows/ci-enterprise.yml",
    ],
  },
  agents_gate: {
    workflow: ".github/workflows/ci-agents.yml",
    paths: [
      "app/**",
      "components/**",
      "lib/**",
      "public/**",
      "studio/**",
      "supabase/**",
      "scripts/**",
      "tests/**",
      "e2e/**",
      "middleware.ts",
      "next.config.ts",
      "instrumentation.ts",
      "vercel.json",
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "vitest.config.ts",
      "playwright.config.ts",
      "tailwind.config.cjs",
      "postcss.config.cjs",
      ".eslintrc.cjs",
      "eslint.config.*",
      "AGENTS.md",
      ".github/workflows/ci-agents.yml",
    ],
  },
  staging: {
    workflow: ".github/workflows/supabase-migrate.yml",
    paths: SUPABASE_MIGRATE_CI_PATHS,
  },
  week_visual: {
    workflow: ".github/workflows/ci-week-visual.yml",
    paths: [
      "app/(app)/week/**",
      "components/employee/**",
      "app/styles/**",
      "e2e/week-visual-regression.e2e.ts",
      "e2e/week-row-radius-probe.e2e.ts",
      "e2e/week-slot-probe.e2e.ts",
      "e2e/week-chip-probe.e2e.ts",
      "e2e/week-motion-probe.e2e.ts",
      "e2e/week-state-probe.e2e.ts",
      "e2e/week-collapse-probe.e2e.ts",
      "e2e/week-icon-probe.e2e.ts",
      "e2e/week-typography-probe.e2e.ts",
      "e2e/week-icon-eyes-on.e2e.ts",
      "playwright.week-row-probe.config.ts",
      "e2e/helpers/week-visual.ts",
      "e2e/helpers/week-visual-auth.ts",
      "e2e/global-setup/week-visual-auth.setup.ts",
      "e2e/fixtures/week-visual-window.base.json",
      "playwright.week-visual.config.ts",
      "e2e/week-visual-regression.e2e.ts-snapshots/**",
      "scripts/e2e/retry-seed-with-backoff.sh",
      "scripts/ci/retry-npm-ci.sh",
      "scripts/ci/retry-transient-network.sh",
      ".github/workflows/ci-week-visual.yml",
      "vercel.json",
    ],
  },
};

/** Branch-protection context name per internal check key. */
export const REQUIRED_CHECK_CONTEXT_NAMES = {
  build: "build",
  enterprise: "enterprise",
  agents_gate: "agents_gate",
  staging: "staging",
  week_visual: "week-visual",
};
