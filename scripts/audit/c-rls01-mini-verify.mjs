#!/usr/bin/env node
/** C-RLS-01 mini-verify: prod policies not in golden vs migration CREATE POLICY */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const golden = JSON.parse(fs.readFileSync("tests/rls/golden-rls-snapshot.json", "utf8"));
const prod = JSON.parse(fs.readFileSync(".tmp/prod-policies-mcp.json", "utf8"));

function key(p) {
  const schema = p.schemaname ?? p.schema ?? "public";
  const table = p.tablename ?? p.table;
  const name = p.policyname ?? p.name;
  return `${schema}.${table}.${name}`;
}

const goldenSet = new Set((golden.policies || []).map(key));
const prodPolicies = prod.policies || prod;

const missing = prodPolicies.filter((p) => !goldenSet.has(key(p)));
console.error("prod", prodPolicies.length, "golden", goldenSet.size, "missing", missing.length);

// deterministic sample: sort by key, take indices seeded
const sorted = [...missing].sort((a, b) => key(a).localeCompare(key(b)));
const seed = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36].filter((i) => i < sorted.length);
const sample = seed.map((i) => sorted[i]);

const migDir = path.resolve("supabase/migrations");
const migFiles = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql"));

function findMigration(policyName) {
  const hits = [];
  for (const f of migFiles) {
    const content = fs.readFileSync(path.join(migDir, f), "utf8");
    const re = new RegExp(`create\\s+policy\\s+["']?${policyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']?`, "i");
    if (re.test(content)) hits.push(f);
  }
  return hits;
}

const rows = sample.map((p) => {
  const policyName = p.policyname ?? p.name;
  const hits = findMigration(policyName);
  return {
    policy: key(p),
    policyname: policyName,
    table: p.tablename ?? p.table,
    cmd: p.cmd,
    migration_hits: hits,
    klass: hits.length > 0 ? "TRACKED" : "UNTRACKED",
  };
});

const untracked = rows.filter((r) => r.klass === "UNTRACKED").length;
console.log(JSON.stringify({ missing_total: missing.length, sample_n: rows.length, untracked_in_sample: untracked, rows }, null, 2));
