#!/usr/bin/env node
/**
 * Database reproducibility auditor: empty DB → run all migrations → verify schema.
 * - Runs migration gate (order + naming).
 * - Runs supabase db reset when Supabase CLI and local DB are available.
 * - Verifies schema: tables, constraints, indexes, RPCs.
 * - Output: rebuild result, mismatches, fixes (recommendations), final verification.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/ci/db-rebuild-verify.mjs   # verify only
 *   node scripts/ci/db-rebuild-verify.mjs                    # reset + verify if local Supabase
 */

import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

let pgClient;
try {
  const pg = await import("pg");
  pgClient = pg.Client;
} catch {
  pgClient = null;
}

const projectRoot = join(process.cwd());
const migrationsDir = join(projectRoot, "supabase", "migrations");

// Expected schema (from migrations + db-contracts)
const REQUIRED_TABLES = [
  "companies",
  "company_locations",
  "profiles",
  "agreements",
  "orders",
  "outbox",
  "idempotency",
  "company_deletions",
  "audit_events",
  "system_health_snapshots",
  "system_incidents",
  "repair_jobs",
  "ops_events",
  "enterprise_groups",
  "incidents",
  "daily_company_rollup",
  "daily_employee_orders",
  "invoice_lines",
  "invoice_exports",
  "esg_monthly",
  "invoice_periods",
  "company_registrations",
  "billing_tax_codes",
  "billing_products",
  "tripletex_customers",
  "tripletex_exports",
  "employee_invites",
  "content_pages",
  "content_page_variants",
  "content_releases",
  "content_release_items",
  "content_workflow_state",
  "content_audit_log",
  "content_analytics_events",
  "content_health",
  "content_experiments",
  "forms",
  "form_submissions",
  "ai_activity_log",
  "ai_suggestions",
  "ai_jobs",
  "media_items",
  "entities",
  "entity_relations",
  "experiment_results",
  "ab_experiments",
  "ab_variants",
];

const REQUIRED_CONSTRAINTS = [
  { table: "company_deletions", name: "company_deletions_mode_ck" },
  { table: "outbox", name: "outbox_status_check" },
];

const REQUIRED_INDEXES = [
  "profiles_company_id_idx",
  "outbox_claim_idx",
];

const REQUIRED_FUNCTIONS = ["lp_order_set", "lp_pgrst_reload_schema"];

function run(cmd, args = [], opts = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd: projectRoot,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      ...opts,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => { stdout += d; });
    proc.stderr?.on("data", (d) => { stderr += d; });
    proc.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function migrationGate() {
  try {
    const script = join(projectRoot, "scripts", "ci", "migration-gate.mjs");
    readFileSync(script, "utf8");
    return run("node", [script]);
  } catch (e) {
    return Promise.resolve({ code: 1, stdout: "", stderr: String(e.message) });
  }
}

async function supabaseDbReset() {
  return run("supabase", ["db", "reset"]);
}

function getLocalDbUrl() {
  // Supabase local default from config.toml port 54322
  return process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
}

async function verifySchema(connectionUrl) {
  if (!pgClient) {
    return { verified: null, skipped: true, mismatches: [], details: {}, skipReason: "pg not installed (npm i -D pg for schema verification)" };
  }
  const client = new pgClient({ connectionString: connectionUrl });
  const mismatches = [];
  let verified = true;

  try {
    await client.connect();
  } catch (e) {
    return { verified: false, skipped: false, mismatches: [`Could not connect: ${e.message}`], details: {} };
  }

  const details = { tables: [], constraints: [], indexes: [], functions: [] };

  try {
    // Tables
    const { rows: tableRows } = await client.query(`
      select tablename from pg_tables where schemaname = 'public' order by tablename
    `);
    const existingTables = tableRows.map((r) => r.tablename);
    details.tables = existingTables;

    for (const t of REQUIRED_TABLES) {
      if (!existingTables.includes(t)) {
        mismatches.push(`Missing table: public.${t}`);
        verified = false;
      }
    }

    // Constraints (check by conname for public schema)
    const { rows: constraintRows } = await client.query(`
      select c.conname, t.relname as table_name
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and c.contype = 'c'
    `);
    const constraintSet = new Set(constraintRows.map((r) => `${r.table_name}.${r.conname}`));
    details.constraints = constraintRows.map((r) => `${r.table_name}.${r.conname}`);

    for (const { table, name } of REQUIRED_CONSTRAINTS) {
      if (!constraintSet.has(`${table}.${name}`)) {
        mismatches.push(`Missing constraint: public.${table}.${name}`);
        verified = false;
      }
    }

    // Indexes
    const { rows: indexRows } = await client.query(`
      select indexname from pg_indexes where schemaname = 'public'
    `);
    const indexNames = indexRows.map((r) => r.indexname);
    details.indexes = indexNames;

    for (const idx of REQUIRED_INDEXES) {
      if (!indexNames.includes(idx)) {
        mismatches.push(`Missing index: public.${idx}`);
        verified = false;
      }
    }

    // Functions
    const { rows: funcRows } = await client.query(`
      select p.proname from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = any($1::text[])
    `, [REQUIRED_FUNCTIONS]);
    const funcNames = funcRows.map((r) => r.proname);
    details.functions = funcNames;

    for (const fn of REQUIRED_FUNCTIONS) {
      if (!funcNames.includes(fn)) {
        mismatches.push(`Missing function: public.${fn}()`);
        verified = false;
      }
    }
  } finally {
    await client.end();
  }

  return { verified, skipped: false, mismatches, details };
}

async function main() {
  const out = {
    rebuildResult: null,
    migrationGateResult: null,
    mismatches: [],
    fixesApplied: [],
    schemaVerification: null,
  };

  console.log("=== 1) Migration gate (order + naming) ===");
  const gate = await migrationGate();
  out.migrationGateResult = gate.code === 0 ? "PASS" : "FAIL";
  if (gate.stdout) console.log(gate.stdout.trim());
  if (gate.stderr) console.error(gate.stderr.trim());
  if (gate.code !== 0) {
    console.error("Migration gate FAILED. Fix migration order/naming before rebuild.");
    process.exitCode = 1;
    return out;
  }

  console.log("\n=== 2) Rebuild (empty DB → run all migrations) ===");
  const dbUrl = process.env.DATABASE_URL?.trim();
  const runReset = !dbUrl && existsSync(join(projectRoot, "supabase", "config.toml"));

  if (runReset) {
    const reset = await supabaseDbReset();
    out.rebuildResult = {
      ran: true,
      exitCode: reset.code,
      success: reset.code === 0,
      stderr: reset.stderr.trim().slice(-2000),
    };
    if (reset.code !== 0) {
      console.error("supabase db reset failed (exit " + reset.code + ")");
      console.error(reset.stderr.slice(-1500));
      out.mismatches.push("Rebuild failed: supabase db reset exited non-zero.");
      out.fixesApplied.push("Ensure Supabase CLI is installed and local DB is running (e.g. supabase start). If seed fails, add or disable seed in config.toml.");
      process.exitCode = 1;
    } else {
      console.log("supabase db reset completed successfully.");
    }
  } else {
    out.rebuildResult = { ran: false, reason: dbUrl ? "DATABASE_URL set (verify-only mode)" : "no supabase/config.toml" };
    console.log("Skipping reset: " + out.rebuildResult.reason);
  }

  console.log("\n=== 3) Schema verification ===");
  const verifyUrl = dbUrl || (out.rebuildResult?.success ? getLocalDbUrl() : null);
  if (!verifyUrl) {
    console.log("No DB URL available. Set DATABASE_URL to verify existing DB, or run with local Supabase (supabase start && node scripts/ci/db-rebuild-verify.mjs).");
    out.schemaVerification = { verified: false, skipped: true, reason: "no connection" };
    return out;
  }

  const verification = await verifySchema(verifyUrl);
  out.schemaVerification = {
    verified: verification.verified,
    skipped: verification.skipped,
    skipReason: verification.skipReason,
    mismatches: verification.mismatches,
    tableCount: verification.details?.tables?.length ?? 0,
    constraintCount: verification.details?.constraints?.length ?? 0,
    indexCount: verification.details?.indexes?.length ?? 0,
  };

  if (verification.skipped) {
    console.log("Schema verification skipped: " + (verification.skipReason || "no connection"));
  } else if (verification.mismatches.length) {
    out.mismatches.push(...verification.mismatches);
    console.error("Mismatches:");
    verification.mismatches.forEach((m) => console.error("  - " + m));
    if (verification.mismatches.some((m) => m.startsWith("Missing table"))) {
      out.fixesApplied.push("Add missing table in a new migration or fix migration order so the table is created.");
    }
    if (verification.mismatches.some((m) => m.startsWith("Missing constraint"))) {
      out.fixesApplied.push("Add missing CHECK constraint in a new migration.");
    }
    if (verification.mismatches.some((m) => m.startsWith("Missing index"))) {
      out.fixesApplied.push("Add missing index in a new migration.");
    }
    process.exitCode = 1;
  } else if (verification.verified === true) {
    console.log("OK: Schema verification passed.");
    console.log("  Tables: " + (verification.details?.tables?.length ?? 0));
    console.log("  Constraints (CHECK): " + (verification.details?.constraints?.length ?? 0));
    console.log("  Indexes: " + (verification.details?.indexes?.length ?? 0));
  }

  console.log("\n=== 4) Summary ===");
  console.log("Rebuild: " + (out.rebuildResult?.success === true ? "OK" : out.rebuildResult?.ran === false ? "skipped" : "FAIL"));
  console.log("Schema verification: " + (out.schemaVerification.skipped ? "SKIPPED" : out.schemaVerification.verified ? "PASS" : "FAIL"));
  if (out.fixesApplied.length) console.log("Suggested fixes: " + out.fixesApplied.join(" "));

  return out;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
