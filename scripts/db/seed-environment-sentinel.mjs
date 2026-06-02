#!/usr/bin/env node
/**
 * Ref-verified B-only bootstrap: DDL + sentinel seed + migration ledger record.
 *
 *   node scripts/db/seed-environment-sentinel.mjs --expect staging
 *   node scripts/db/seed-environment-sentinel.mjs --expect production  (owner go)
 *
 * Full guard / CI / guarded-push abort on missing sentinel — this script is the
 * only approved path to create _meta.environment before normal A+B guard passes.
 *
 * Chain (fail-closed):
 *   1) assert-db-target --bootstrap  (B only — ref must match label)
 *   2) CREATE SCHEMA/TABLE IF NOT EXISTS (20260701120000 DDL)
 *   3) bootstrap guard → INSERT sentinel row
 *   4) bootstrap guard → INSERT schema_migrations ledger row (idempotent)
 *   5) assert-db-target --expect     (A + B — must proceed)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import dotenv from "dotenv";
import {
  assertDbTarget,
  createPgClientConfig,
  PROJECT_REFS,
} from "../ci/assert-db-target.mjs";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

/** @typedef {"staging" | "production"} DbEnvironment */

export const META_ENV_MIGRATION_VERSION = "20260701120000";
export const META_ENV_MIGRATION_NAME = "meta_environment_sentinel";

const ROOT = process.cwd();
const DDL_FILE = join(ROOT, "supabase/migrations/20260701120000_meta_environment_sentinel.sql");
const LEDGER_FILE = join(ROOT, "scripts/db/record-meta-environment-ledger.sql");

function parseExpect(argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--expect" && argv[i + 1]) {
      return /** @type {DbEnvironment} */ (argv[++i]);
    }
  }
  return null;
}

function seedFileFor(expect) {
  return join(
    ROOT,
    "scripts/db",
    expect === "staging" ? "seed-environment-sentinel-staging.sql" : "seed-environment-sentinel-production.sql",
  );
}

/**
 * @param {string} connectionString
 * @param {DbEnvironment} expect
 * @param {string} phase
 */
async function requireBootstrapGuard(connectionString, expect, phase) {
  console.log(`seed-environment-sentinel: bootstrap guard (B only) — ${phase}`);
  const result = await assertDbTarget({ connectionString, expect, bootstrap: true });
  if (result.decision !== "proceed") {
    console.error(`::error::seed-environment-sentinel ABORT at ${phase} (${result.reason})`);
    process.exit(1);
  }
  console.log(`seed-environment-sentinel: bootstrap OK phase=${phase} parsedRef=${result.parsedRef}`);
}

const isMain = process.argv[1]?.includes("seed-environment-sentinel.mjs");

if (isMain) {
  const expect = parseExpect(process.argv.slice(2));
  if (expect !== "staging" && expect !== "production") {
    console.error("::error::seed-environment-sentinel: --expect staging|production is required");
    process.exit(1);
  }

  const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
  if (!databaseUrl) {
    console.error("::error::seed-environment-sentinel: DATABASE_URL not set");
    process.exit(1);
  }

  console.log(`seed-environment-sentinel: target ${expect} → ref ${PROJECT_REFS[expect]}`);

  await requireBootstrapGuard(databaseUrl, expect, "pre-ddl");

  const ddl = readFileSync(DDL_FILE, "utf8");
  const seedSql = readFileSync(seedFileFor(expect), "utf8");
  const ledgerSql = readFileSync(LEDGER_FILE, "utf8");

  const client = new Client(createPgClientConfig(databaseUrl));
  await client.connect();
  try {
    await client.query(ddl);
    console.log(`seed-environment-sentinel: DDL applied (${DDL_FILE})`);
  } catch (err) {
    console.error(`::error::seed-environment-sentinel: DDL failed — ${/** @type {Error} */ (err).message}`);
    process.exit(1);
  } finally {
    await client.end();
  }

  await requireBootstrapGuard(databaseUrl, expect, "pre-seed");

  const clientSeed = new Client(createPgClientConfig(databaseUrl));
  await clientSeed.connect();
  try {
    await clientSeed.query(seedSql);
    console.log(`seed-environment-sentinel: sentinel seed applied (${seedFileFor(expect)})`);
  } catch (err) {
    console.error(`::error::seed-environment-sentinel: seed failed — ${/** @type {Error} */ (err).message}`);
    process.exit(1);
  } finally {
    await clientSeed.end();
  }

  await requireBootstrapGuard(databaseUrl, expect, "pre-ledger");

  const clientLedger = new Client(createPgClientConfig(databaseUrl));
  await clientLedger.connect();
  try {
    await clientLedger.query(ledgerSql);
    const { rows } = await clientLedger.query(
      `SELECT version, name FROM supabase_migrations.schema_migrations WHERE version = $1`,
      [META_ENV_MIGRATION_VERSION],
    );
    if (!rows.length) {
      console.error("::error::seed-environment-sentinel: ledger record missing after insert");
      process.exit(1);
    }
    console.log(
      `seed-environment-sentinel: ledger recorded version=${rows[0].version} name=${rows[0].name}`,
    );
  } catch (err) {
    console.error(`::error::seed-environment-sentinel: ledger failed — ${/** @type {Error} */ (err).message}`);
    process.exit(1);
  } finally {
    await clientLedger.end();
  }

  console.log(`seed-environment-sentinel: post-bootstrap full guard (A + B) for ${expect}`);
  const verified = await assertDbTarget({ connectionString: databaseUrl, expect });
  if (verified.decision !== "proceed") {
    console.error(`::error::seed-environment-sentinel ABORT after bootstrap (${verified.reason})`);
    process.exit(1);
  }

  console.log(
    `seed-environment-sentinel: complete sentinel=${verified.sentinel} parsedRef=${verified.parsedRef} ledger=${META_ENV_MIGRATION_VERSION}`,
  );
}
