#!/usr/bin/env node
/**
 * Idempotent Provider A/B staging fixture (uigx only).
 *
 * Corrects Provider A agreement/provider mismatch and seeds Provider B stack
 * for multi-provider E2E proof. Does NOT send email, touch Tripletex, or run
 * against prod.
 *
 * Usage (operator — not part of CI):
 *   node scripts/ci/assert-db-target.mjs --expect staging
 *   node scripts/smoke/seed-provider-ab-fixture.mjs
 *
 * Prerequisite: migrations + seed-staging-tenant.sql (or equivalent baseline).
 * Next: seed-provider-ab-sanity.mjs (dry-run), provision Provider B users, 20-case proof.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { assertDbTarget } from "../ci/assert-db-target.mjs";
import {
  FIXTURE_DATE,
  PROVIDER_A,
  PROVIDER_B,
  PROVIDER_B_PROVISION_EMAILS,
  STAGING_PROJECT_REF,
} from "./fixtures/provider-ab-staging.constants.mjs";
import {
  assertStagingDatabaseUrl,
  buildProviderAbFixtureSql,
  validateProviderAbFixtureConstants,
} from "./provider-ab-fixture-core.mjs";
import {
  loadEnvFiles,
  normalizePgUrl,
  resolveStagingDatabaseUrl,
} from "./resolve-staging-database-url.mjs";

export {
  assertStagingDatabaseUrl,
  buildProviderAbFixtureSql,
  validateProviderAbFixtureConstants,
} from "./provider-ab-fixture-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

/** @param {string} connectionString */
export async function assertStagingDbTarget(connectionString) {
  const result = await assertDbTarget({ connectionString, expect: "staging" });
  if (result.decision !== "proceed") {
    throw new Error(`ABORT: assert-db-target failed (${result.reason})`);
  }
  return result;
}

/**
 * @param {import('pg').Client} client
 */
async function verifyFixture(client) {
  const { rows } = await client.query(
    `select
       (select provider_id::text from public.companies where id = $1) as company_a_provider,
       (select provider_id::text from public.agreements where id = $2) as agreement_a_provider,
       (select count(*)::int from public.providers where id = $3) as provider_b_exists,
       (select count(*)::int from public.companies where id = $4) as company_b_exists,
       (select count(*)::int from public.agreements where id = $5 and status = 'ACTIVE') as agreement_b_active,
       (select count(*)::int from public.provider_service_areas where id = $6) as area_b_exists,
       (select count(*)::int from public.menu_service_day_items where id = $7) as menu_b_item`,
    [
      PROVIDER_A.companyId,
      PROVIDER_A.agreementId,
      PROVIDER_B.providerId,
      PROVIDER_B.companyId,
      PROVIDER_B.agreementId,
      PROVIDER_B.serviceAreaId,
      PROVIDER_B.menuItemId,
    ],
  );
  const row = rows[0] ?? {};
  const melhusId = PROVIDER_A.providerId;
  if (row.company_a_provider !== melhusId || row.agreement_a_provider !== melhusId) {
    throw new Error(
      `verify: Provider A mismatch company=${row.company_a_provider} agreement=${row.agreement_a_provider}`,
    );
  }
  if (row.provider_b_exists < 1 || row.company_b_exists < 1 || row.agreement_b_active < 1) {
    throw new Error(`verify: Provider B core rows missing (${JSON.stringify(row)})`);
  }
  if (row.area_b_exists < 1 || row.menu_b_item < 1) {
    throw new Error(`verify: Provider B coverage/menu missing (${JSON.stringify(row)})`);
  }
  return row;
}

/**
 * @returns {Promise<{ providerACorrected: boolean, providerBSeeded: boolean, coverage: object, ids: object, nextCommands: string[] }>}
 */
export async function seedProviderAbFixture() {
  const validation = validateProviderAbFixtureConstants();
  if (!validation.ok) {
    throw new Error(`fixture constants invalid: ${validation.errors.join("; ")}`);
  }

  loadEnvFiles(ROOT);
  const picked = assertStagingDatabaseUrl(resolveStagingDatabaseUrl());
  const connectionString = normalizePgUrl(picked.url);

  console.log(
    "PROVIDER_AB_FIXTURE_TARGET",
    JSON.stringify({ envKey: picked.key, stagingRef: STAGING_PROJECT_REF }),
  );

  await assertStagingDbTarget(connectionString);

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query("begin");
    await client.query(buildProviderAbFixtureSql());
    const verify = await verifyFixture(client);
    await client.query("commit");

    return {
      providerACorrected: true,
      providerBSeeded: true,
      coverage: {
        providerA: `${PROVIDER_A.coverageFrom}-${PROVIDER_A.coverageTo} (${PROVIDER_A.testPostalCode})`,
        providerB: `${PROVIDER_B.coverageFrom}-${PROVIDER_B.coverageTo} (${PROVIDER_B.testPostalCode})`,
      },
      ids: {
        providerA: PROVIDER_A.providerId,
        providerB: PROVIDER_B.providerId,
        companyA: PROVIDER_A.companyId,
        companyB: PROVIDER_B.companyId,
        agreementA: PROVIDER_A.agreementId,
        agreementB: PROVIDER_B.agreementId,
        fixtureDate: FIXTURE_DATE,
      },
      verify,
      nextCommands: [
        "node scripts/smoke/seed-provider-ab-sanity.mjs",
        "node scripts/smoke/seed-provider-ab-sanity.mjs --execute",
        `provision provider admin: ${PROVIDER_B_PROVISION_EMAILS.providerAdmin}`,
        `provision provider kitchen: ${PROVIDER_B_PROVISION_EMAILS.providerKitchen}`,
        `provision company admin: ${PROVIDER_B_PROVISION_EMAILS.companyAdmin}`,
        `provision employee: ${PROVIDER_B_PROVISION_EMAILS.employee}`,
        "node scripts/smoke/seed-smoke-menu-fixture.mjs",
        "run 20-case A/B proof matrix",
      ],
    };
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    await client.end();
  }
}

async function main() {
  const summary = await seedProviderAbFixture();
  console.log("PROVIDER_AB_FIXTURE_OK", JSON.stringify(summary));
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((e) => {
    console.error("PROVIDER_AB_FIXTURE_FAIL", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
