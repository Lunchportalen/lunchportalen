#!/usr/bin/env node
/** Classify ALL prod policies missing from golden: TRACKED vs UNTRACKED */
import fs from "node:fs";
import path from "node:path";

const golden = JSON.parse(fs.readFileSync("tests/rls/golden-rls-snapshot.json", "utf8"));
const prod = JSON.parse(fs.readFileSync(".tmp/prod-policies-mcp.json", "utf8"));

function key(p) {
  const schema = p.schemaname ?? p.schema ?? "public";
  const table = p.tablename ?? p.table;
  const name = p.policyname ?? p.name;
  return `${schema}.${table}.${name}`;
}

const goldenSet = new Set((golden.policies || []).map(key));
const missing = (prod.policies || prod).filter((p) => !goldenSet.has(key(p))).sort((a, b) => key(a).localeCompare(key(b)));

const migDir = path.resolve("supabase/migrations");
const migFiles = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql"));

function findMigration(policyName) {
  const hits = [];
  const re = new RegExp(`create\\s+policy\\s+["']?${policyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']?`, "i");
  for (const f of migFiles) {
    if (re.test(fs.readFileSync(path.join(migDir, f), "utf8"))) hits.push(f);
  }
  return hits;
}

const rows = missing.map((p) => {
  const policyName = p.policyname ?? p.name;
  const hits = findMigration(policyName);
  return { policy: key(p), policyname: policyName, table: p.tablename ?? p.table, cmd: p.cmd, migration_hits: hits, klass: hits.length ? "TRACKED" : "UNTRACKED" };
});

const tracked = rows.filter((r) => r.klass === "TRACKED").length;
const untracked = rows.filter((r) => r.klass === "UNTRACKED").length;
console.log(JSON.stringify({ prod: prod.policies?.length ?? prod.length, golden: goldenSet.size, missing: missing.length, tracked, untracked, rows }, null, 2));
