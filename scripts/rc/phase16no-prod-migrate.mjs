#!/usr/bin/env node
/**
 * Phase 16NO — apply reviewed production migration range only.
 * Excludes 20260901120000 (review-ops). Target head: 20260902120000.
 *
 *   node scripts/rc/phase16no-prod-migrate.mjs --dry-run
 *   node scripts/rc/phase16no-prod-migrate.mjs --apply
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !args.has("--apply");
const envPath = "C:/prosjekter/lunchportalen/.env.local";
const TARGET = "20260902120000";
const PROD_HEAD_BEFORE = "20260818120000";
const EXCLUDED = new Set(["20260901120000"]);

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    out[line.slice(0, i)] = line.slice(i + 1).replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv(envPath);
const dbUrl = env.DATABASE_URL;
if (!dbUrl) {
  console.error("FAIL: DATABASE_URL missing");
  process.exit(1);
}
const host = new URL(dbUrl).hostname;
console.log(`db_host=${host}`);
if (!/aws-1|hkpokyapzarefrgqzkos/.test(host)) {
  console.error("FAIL: refusing unexpected DB host");
  process.exit(2);
}

const migDir = path.join(root, "supabase/migrations");
const parkDir = path.join(root, "docs/rc/phase16no/_parked-migrations");
fs.mkdirSync(parkDir, { recursive: true });

const files = fs.readdirSync(migDir).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
const parked = [];

for (const f of files) {
  const version = f.slice(0, 14);
  const shouldPark = EXCLUDED.has(version) || version > TARGET;
  if (!shouldPark) continue;
  const from = path.join(migDir, f);
  const to = path.join(parkDir, f);
  fs.renameSync(from, to);
  parked.push({ from, to, f });
  console.log(`PARKED ${f}`);
}

function restoreParked() {
  for (const p of parked) {
    if (fs.existsSync(p.to) && !fs.existsSync(p.from)) fs.renameSync(p.to, p.from);
  }
}

process.on("exit", restoreParked);
process.on("SIGINT", () => {
  restoreParked();
  process.exit(130);
});

const remaining = fs
  .readdirSync(migDir)
  .filter((f) => /^\d+_.*\.sql$/.test(f))
  .sort()
  .filter((f) => f.slice(0, 14) > PROD_HEAD_BEFORE && f.slice(0, 14) <= TARGET);

console.log(`pending_after_park=${remaining.length}`);
for (const f of remaining) console.log(`  ${f}`);

const cmd = ["db", "push", "--db-url", dbUrl, "--yes"];
if (dryRun) cmd.splice(2, 0, "--dry-run");
console.log(`mode=${dryRun ? "DRY_RUN" : "APPLY"}`);

const r = spawnSync("supabase", cmd, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
restoreParked();
parked.length = 0;

if (r.status !== 0) {
  console.error(`FAIL exit=${r.status}`);
  process.exit(r.status || 1);
}
console.log(dryRun ? "DRY_RUN_PASS" : "APPLY_PASS");
