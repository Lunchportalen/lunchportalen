#!/usr/bin/env node
/**
 * Ref-verified bootstrap seed for _meta.environment.
 *
 *   node scripts/db/seed-environment-sentinel.mjs --expect staging
 *   node scripts/db/seed-environment-sentinel.mjs --expect production
 *
 * Chain (fail-closed):
 *   1) assert-db-target --bootstrap  (layer B only — ref must match label)
 *   2) INSERT seed row
 *   3) assert-db-target --expect     (layer A + B)
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

function parseExpect(argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--expect" && argv[i + 1]) {
      return /** @type {DbEnvironment} */ (argv[++i]);
    }
  }
  return null;
}

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

const seedFile = join(
  process.cwd(),
  "scripts/db",
  expect === "staging"
    ? "seed-environment-sentinel-staging.sql"
    : "seed-environment-sentinel-production.sql",
);

console.log(`seed-environment-sentinel: bootstrap guard (B only) for ${expect} → ${PROJECT_REFS[expect]}`);
const bootstrap = await assertDbTarget({ connectionString: databaseUrl, expect, bootstrap: true });
if (bootstrap.decision !== "proceed") {
  console.error(`::error::seed-environment-sentinel ABORT at bootstrap (${bootstrap.reason})`);
  process.exit(1);
}
console.log(`seed-environment-sentinel: bootstrap OK parsedRef=${bootstrap.parsedRef}`);

const sql = readFileSync(seedFile, "utf8");
const client = new Client(createPgClientConfig(databaseUrl));
await client.connect();
try {
  await client.query(sql);
} catch (err) {
  console.error(`::error::seed-environment-sentinel: seed failed — ${/** @type {Error} */ (err).message}`);
  process.exit(1);
} finally {
  await client.end();
}
console.log(`seed-environment-sentinel: seed SQL applied (${seedFile})`);

console.log(`seed-environment-sentinel: post-seed guard (A + B) for ${expect}`);
const verified = await assertDbTarget({ connectionString: databaseUrl, expect });
if (verified.decision !== "proceed") {
  console.error(`::error::seed-environment-sentinel ABORT after seed (${verified.reason})`);
  process.exit(1);
}
console.log(
  `seed-environment-sentinel: complete sentinel=${verified.sentinel} parsedRef=${verified.parsedRef}`,
);
