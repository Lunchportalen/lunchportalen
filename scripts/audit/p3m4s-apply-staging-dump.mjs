/**
 * P3.M4.S — Apply schema dump to staging branch via psql (one-off).
 * Usage: node scripts/audit/p3m4s-apply-staging-dump.mjs <staging_project_ref>
 * Resolves DB URL via `supabase branches get` (never logged).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const STAGING_REF = (process.argv[2] ?? "").trim();
const PARENT_REF = "hkpokyapzarefrgqzkos";

if (!STAGING_REF) {
  console.error("Usage: node scripts/audit/p3m4s-apply-staging-dump.mjs <staging_project_ref>");
  process.exit(1);
}

function stagingDbUrl() {
  const r = spawnSync(
    "npx supabase branches get " +
      STAGING_REF +
      " --project-ref " +
      PARENT_REF +
      " -o env",
    { encoding: "utf8", cwd: root, shell: true },
  );
  if (r.status !== 0) {
    console.error("BRANCH_GET_FAIL");
    console.error((r.stderr || "").slice(0, 400));
    process.exit(1);
  }
  const lines = r.stdout.split(/\r?\n/);
  const line =
    lines.find((l) => l.startsWith("POSTGRES_URL=") && !l.includes("NON_POOLING")) ??
    lines.find((l) => l.startsWith("POSTGRES_URL_NON_POOLING="));
  if (!line) {
    console.error("MISSING_POSTGRES_URL");
    process.exit(1);
  }
  const raw = line.includes("NON_POOLING")
    ? line.slice("POSTGRES_URL_NON_POOLING=".length).trim()
    : line.slice("POSTGRES_URL=".length).trim();
  const u = new URL(raw.replace(/^"|"$/g, ""));
  if (u.port === "6543") u.port = "5432"; // session mode for DDL
  if (!u.searchParams.has("sslmode")) u.searchParams.set("sslmode", "require");
  return u.toString();
}

function runPsql(args, label) {
  const r = spawnSync("psql", args, { encoding: "utf8", maxBuffer: 80 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error(`${label}_FAIL`);
    console.error((r.stderr || r.stdout || "").slice(-4000));
    process.exit(r.status || 1);
  }
  return r;
}

const url = stagingDbUrl();
const dumpPath = join(root, "scripts", "audit", "staging-schema-dump-2026-05-20.sql");
const applyPath = join(root, "scripts", "audit", "staging-schema-dump-2026-05-20.apply.sql");

function buildApplyDump() {
  const sql = readFileSync(dumpPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => !/^\\restrict\b/.test(line) && !/^\\unrestrict\b/.test(line))
    .filter((line) => !/^CREATE SCHEMA (public|private);$/.test(line.trim()))
    .join("\n");
  writeFileSync(applyPath, sql, "utf8");
  return applyPath;
}

runPsql(
  ["--dbname=" + url, "-v", "ON_ERROR_STOP=1", "-Atc", "select current_database()"],
  "PREFLIGHT",
);
console.log("PREFLIGHT_OK");

const resetSql = [
  "DROP SCHEMA IF EXISTS public CASCADE;",
  "DROP SCHEMA IF EXISTS private CASCADE;",
].join("\n");

runPsql(["--dbname=" + url, "-v", "ON_ERROR_STOP=1", "-c", resetSql], "RESET");
console.log("RESET_OK");

const bootstrapSql = [
  "CREATE SCHEMA public;",
  "CREATE SCHEMA private;",
  "GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;",
  "GRANT ALL ON SCHEMA private TO postgres, service_role;",
  "CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;",
  "CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;",
  'CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;',
  "CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;",
].join("\n");
runPsql(["--dbname=" + url, "-v", "ON_ERROR_STOP=1", "-c", bootstrapSql], "BOOTSTRAP");
console.log("BOOTSTRAP_OK");

const applyFile = buildApplyDump();
runPsql(["--dbname=" + url, "-v", "ON_ERROR_STOP=1", "-f", applyFile], "APPLY");
console.log("APPLY_OK");
