#!/usr/bin/env node
/**
 * PHASE 13/14 — FULL RC PROOF ORCHESTRATOR (fail-closed).
 *
 * Production (hkpoky) avvises. Ingen production-migrasjon/deploy.
 *
 * Usage:
 *   node scripts/verify/phase13-21-country-rc-proof.mjs
 *   node scripts/verify/phase13-21-country-rc-proof.mjs --local-only
 *   node scripts/verify/phase13-21-country-rc-proof.mjs --skip-e2e --skip-k6
 *   node scripts/verify/phase13-21-country-rc-proof.mjs --apply-migrations
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvFiles, resolveStagingDatabaseUrl, STAGING_REF, PROD_REF } from "../smoke/resolve-staging-database-url.mjs";
import {
  exitCodeForResults,
  finalBanner,
  runStepCore,
  summarizeResults,
} from "./rcOrchestratorCore.mjs";

loadEnvFiles(process.cwd());

/** Build canonical staging Postgres URL (phase12 pattern). */
function stagingDatabaseUrl() {
  const resolved = resolveStagingDatabaseUrl();
  if (resolved?.url.includes(STAGING_REF)) return resolved.url;
  const pw = encodeURIComponent(String(process.env.SUPABASE_DB_PASSWORD_STAGING ?? "").trim());
  if (pw) return `postgresql://postgres:${pw}@db.${STAGING_REF}.supabase.co:5432/postgres`;
  return resolved?.url ?? null;
}

const args = new Set(process.argv.slice(2));
const localOnly = args.has("--local-only");
const skipE2e = args.has("--skip-e2e") || localOnly;
const skipK6 = args.has("--skip-k6") || localOnly;
const skipStagingIntegration = args.has("--skip-staging-integration") || localOnly;
const skipPhase12 = args.has("--skip-phase12");
const applyMigrations = args.has("--apply-migrations");

/** @type {import("./rcOrchestratorCore.mjs").StepResult[]} */
const results = [];
const extraFailures = [];
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const manifestPath = path.join("docs", "rc", "phase13-release-manifest.md");

const ok = (msg) => console.log(`OK: ${msg}`);
const fail = (msg) => {
  extraFailures.push(msg);
  console.error(`FAIL: ${msg}`);
};

function runStep(id, label, cmd, opts = {}) {
  console.log(`\n── ${label} ──`);
  const r = runStepCore(id, label, cmd, opts);
  results.push(r);
  if (r.pass) ok(`${label} (${r.ms}ms)`);
  else {
    const { failures } = summarizeResults([r]);
    console.error(`FAIL: ${failures[0] ?? label}`);
  }
  return r.pass;
}

function assertStagingTarget() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "");
  if (url.includes(PROD_REF) && !url.includes(STAGING_REF)) {
    throw new Error("ABORT: NEXT_PUBLIC_SUPABASE_URL peker på production — kun staging (uigx) tillatt");
  }
  if (url && !url.includes(STAGING_REF)) {
    throw new Error(`ABORT: forventet staging-ref ${STAGING_REF} i Supabase URL`);
  }
  const dbUrl = stagingDatabaseUrl();
  if (!localOnly && !dbUrl) {
    throw new Error(
      "ABORT: ingen staging DATABASE_URL funnet (.env.local: SUPABASE_DB_PASSWORD_STAGING eller DATABASE_URL mot uigx)",
    );
  }
  return dbUrl;
}

try {
  if (!localOnly) assertStagingTarget();
  else if (args.has("--require-staging")) {
    fail("staging integration required but --local-only was set");
  }

  // -------------------------------------------------------------------------
  // A) LOCAL GATES
  // -------------------------------------------------------------------------
  runStep("typecheck", "typecheck", "npm run typecheck", { rcMode: true });
  runStep("lint", "lint", "npm run lint", { rcMode: true });
  runStep("platform-guards", "ci:platform-guards", "npm run ci:platform-guards", { rcMode: true });

  runStep("21-country-markets", "21-country market gate", "node scripts/ci/verify-21-country-markets.mjs");
  runStep("21-language-e2e", "24-locale language gate", "node scripts/ci/verify-21-language-e2e.mjs");
  runStep("language-content", "15/15 language content gate", "node scripts/ci/verify-language-content.mjs");

  runStep("vitest-full", "full Vitest (contract + unit)", "npm run test:run", {
    rcMode: true,
    env: { RUN_SUPABASE_INTEGRATION_TESTS: "0", VITEST_SUPABASE_INTEGRATION: "0" },
  });
  runStep("vitest-rls", "full RLS suite", "npm run test:rls", {
    rcMode: true,
    env: { RUN_SUPABASE_INTEGRATION_TESTS: "1", VITEST_SUPABASE_INTEGRATION: "1" },
  });
  runStep("vitest-tenant", "tenant isolation A/B/C (unit)", "npm run test:tenant", { rcMode: true });
  runStep("golden-path", "protected golden path", "npm run test:golden-path", { rcMode: true });
  runStep("vitest-db", "database integrity", "npm run test:db", { rcMode: true });

  runStep(
    "invoice-email-snapshots",
    "invoice snapshots + email previews (15/15)",
    "npx vitest run tests/i18n/invoiceAndEmailSnapshots.test.tsx --config vitest.config.ts",
    { rcMode: true },
  );

  runStep(
    "security-matrix",
    "security negative matrix (allowlist + bypass)",
    "npx vitest run tests/security/api-allowlist-regression.test.ts tests/security/no-implicit-bypass.test.ts tests/security/cron-fail-closed.test.ts --config vitest.config.ts",
    { rcMode: true },
  );

  runStep(
    "idempotency",
    "idempotency + retry contracts",
    "npx vitest run tests/api/orders-idempotency.test.ts tests/billing/commissionSettlement.test.ts --config vitest.config.ts",
    { rcMode: true },
  );

  runStep(
    "i18n-quality",
    "launch language quality (Phase 11 contracts)",
    "npx vitest run tests/i18n/launchLanguageQuality.test.ts --config vitest.config.ts",
    { rcMode: true },
  );

  runStep(
    "tax-readiness",
    "global tax readiness contracts",
    "npx vitest run tests/tax/globalTaxReadiness.test.ts tests/tax/invoiceDocumentLegalFields.test.tsx --config vitest.config.ts",
    { rcMode: true },
  );

  runStep("build-enterprise", "build:enterprise gate", "npm run build:enterprise", {
    rcMode: true,
    productionNodeEnv: true,
  });

  runStep("manifest", "release manifest (SHA + migration checksums)", "node scripts/verify/generate-release-manifest.mjs --write-json", {
    requiredArtifact: manifestPath,
  });

  if (localOnly) {
    const code = exitCodeForResults(results, extraFailures);
    const banner = finalBanner(true, code === 0);
    console.log(`\n${banner}`);
    process.exit(code);
  }

  // -------------------------------------------------------------------------
  // B) STAGING DB
  // -------------------------------------------------------------------------
  const dbUrl = assertStagingTarget();

  if (applyMigrations) {
    runStep(
      "db-push-staging",
      "apply pending migrations (guarded db push → staging)",
      "node scripts/db/guarded-db-push.mjs --expect staging",
      { env: { DATABASE_URL: dbUrl } },
    );
  }

  if (!skipPhase12) {
    runStep("phase12-staging", "Phase 12 staging verification + rollback drill", "node scripts/verify/phase12-21-country-staging.mjs");
  }

  runStep(
    "post-migration",
    "post-migration verify (staging)",
    "node scripts/ci/post-migration-verify.mjs",
    { env: { DATABASE_URL: dbUrl } },
  );

  runStep("rls-drift", "RLS drift check", "npm run check:rls-drift", { rcMode: true });

  runStep("db-rebuild", "database migration rebuild verify", "npm run db:rebuild-verify", {
    env: { DATABASE_URL: dbUrl },
  });

  // -------------------------------------------------------------------------
  // C) STAGING INTEGRATION
  // -------------------------------------------------------------------------
  if (skipStagingIntegration) {
    fail("staging integration required but was skipped");
  } else {
    const intEnv = {
      RUN_SUPABASE_INTEGRATION_TESTS: "1",
      DATABASE_URL: dbUrl,
      SUPABASE_POSTGRES_URL: dbUrl,
    };

    const integrationSuites = [
      ["integration-canonical-invite", "tests/integration/canonical-invite-accept.integration.test.ts"],
      ["integration-provider-self-service", "tests/integration/provider-self-service.integration.test.ts"],
      ["integration-company-agreement", "tests/integration/company-agreement-lifecycle.integration.test.ts"],
      ["integration-weekly-ordering", "tests/integration/weekly-ordering-cancellation.integration.test.ts"],
      ["integration-kitchen-delivery", "tests/integration/kitchen-packing-delivery.integration.test.ts"],
      ["integration-invoice-only", "tests/integration/invoice-only-billing.integration.test.ts"],
      ["integration-commission", "tests/integration/commission-settlement.integration.test.ts"],
      ["integration-global-tax", "tests/integration/global-tax-readiness.integration.test.ts"],
      ["integration-superadmin-translation", "tests/integration/superadmin-translation.integration.test.ts"],
    ];

    for (const [id, file] of integrationSuites) {
      runStep(
        id,
        `API integration — ${path.basename(file)}`,
        `npx vitest run ${file} --config vitest.config.ts`,
        { env: intEnv, rcMode: true },
      );
    }

    runStep(
      "21-country-rc-proof",
      "FULL 21-COUNTRY RC PROOF (21/21 lifecycle + tenant A/B/C + outbox)",
      "npx vitest run tests/integration/full-21-country-rc-proof.integration.test.ts --config vitest.config.ts",
      { env: intEnv, rcMode: true },
    );
  }

  // -------------------------------------------------------------------------
  // D) E2E
  // -------------------------------------------------------------------------
  if (skipE2e) {
    fail("browser E2E required but skipped (--skip-e2e or --local-only)");
  } else {
    runStep("playwright-core", "Playwright core flows", "npm run e2e", { rcMode: true });
    runStep("playwright-week-visual", "Playwright week visual (mobile + desktop)", "npm run e2e:week-visual", {
      rcMode: true,
    });
  }

  // -------------------------------------------------------------------------
  // E) LOAD / CRON
  // -------------------------------------------------------------------------
  if (skipK6) {
    fail("k6 staging smoke required but skipped (--skip-k6 or --local-only)");
  } else {
    runStep("k6-staging-smoke", "k6 staging smoke", "npm run k6:staging-smoke", { rcMode: true });
  }

  runStep("protected-path-guard", "protected golden path CI guard", "npm run ci:protected-path-guard", { rcMode: true });

  runStep("manifest-full", "immutable release manifest (final)", "node scripts/verify/generate-release-manifest.mjs --write-json", {
    requiredArtifact: manifestPath,
  });
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}

fs.mkdirSync(".backups", { recursive: true });
const reportPath = path.join(".backups", `phase13-rc-proof-${stamp}.json`);
const { failures: stepFailures } = summarizeResults(results);
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      localOnly,
      skipE2e,
      skipK6,
      skipStagingIntegration,
      results,
      stepFailures,
      extraFailures,
    },
    null,
    2,
  ),
  "utf8",
);
console.log(`\nRapport: ${reportPath}`);

const exitCode = exitCodeForResults(results, extraFailures);
const banner = finalBanner(localOnly, exitCode === 0);
console.log(`\n${banner}`);
if (exitCode === 0 && !localOnly) {
  console.log("  21/21 country flows · 15/15 languages · 24/24 locales");
  console.log("  failed=0 · cross-tenant leakage=0 · manifest generert");
}
process.exit(exitCode);
