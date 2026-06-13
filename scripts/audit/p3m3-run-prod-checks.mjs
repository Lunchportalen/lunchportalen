#!/usr/bin/env node
/**
 * P3.M3: run prod existence checks (read-only SELECT).
 * Requires DATABASE_URL or SUPABASE_DB_URL in .env.local
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";
import { createSupabasePoolConfig } from "../rls/golden-snapshot-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

dotenv.config({ path: join(ROOT, ".env.local") });
dotenv.config({ path: join(ROOT, ".env") });

const chunks = JSON.parse(readFileSync(join(ROOT, ".p3m3-mini-chunks.json"), "utf8"));
const pool = new pg.Pool(createSupabasePoolConfig());

const allRows = [];
for (let i = 0; i < chunks.length; i++) {
  const { rows } = await pool.query(chunks[i]);
  allRows.push(...rows);
  console.error(`chunk ${i}: ${rows.length} rows`);
}
await pool.end();

writeFileSync(join(ROOT, ".p3m3-check-results.json"), JSON.stringify(allRows, null, 2));
console.log(`Wrote ${allRows.length} check results`);
