#!/usr/bin/env node
/** Compare repo migrations vs prod ledger JSON from MCP or manual list */
import fs from "node:fs";
import path from "node:path";

const migDir = path.resolve("supabase/migrations");
const repoFiles = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();

const repoByVersion = new Map();
const repoBySlug = new Map();
for (const f of repoFiles) {
  const version = f.replace(/_.*$/, "");
  const slug = f.replace(/^\d+_?/, "").replace(/\.sql$/, "");
  repoByVersion.set(version, f);
  if (!repoBySlug.has(slug)) repoBySlug.set(slug, []);
  repoBySlug.get(slug).push(f);
}

// Parse prod list from stdin or file
const prodPath = process.argv[2];
if (!prodPath || !fs.existsSync(prodPath)) {
  console.error("Usage: node c1-migration-ledger-compare.mjs <prod-migrations.json>");
  process.exit(1);
}
const prod = JSON.parse(fs.readFileSync(prodPath, "utf8"));
const entries = Array.isArray(prod) ? prod : prod.migrations ?? prod.rows ?? [];

const classified = [];
for (const e of entries) {
  const version = String(e.version ?? e.name?.split("_")[0] ?? "");
  const name = String(e.name ?? e.slug ?? "").replace(/\.sql$/, "");
  const repoExact = repoFiles.find((f) => f.startsWith(version + "_") || f === `${version}.sql`);
  const repoByName = repoBySlug.get(name) ?? repoBySlug.get(name.replace(/-/g, "_"));
  let status = "APPLIED_OUTSIDE_GIT";
  let repoMatch = null;
  if (repoExact) {
    status = "EXACT_VERSION";
    repoMatch = repoExact;
  } else if (repoByName?.length === 1) {
    status = "NAME_MATCH_DIFF_VERSION";
    repoMatch = repoByName[0];
  } else if (repoByName?.length > 1) {
    status = "NAME_AMBIGUOUS";
    repoMatch = repoByName.join("|");
  }
  classified.push({ version, name, status, repoMatch });
}

const counts = {};
for (const c of classified) counts[c.status] = (counts[c.status] ?? 0) + 1;

console.log(JSON.stringify({ total_prod: classified.length, total_repo: repoFiles.length, counts, outside: classified.filter((c) => c.status === "APPLIED_OUTSIDE_GIT") }, null, 2));
