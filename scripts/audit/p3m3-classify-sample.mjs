#!/usr/bin/env node
/**
 * P3.M3 read-only: parse migration SQL and emit prod verification SQL.
 * Usage: node scripts/audit/p3m3-classify-sample.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "../..");
const samplePath = join(ROOT, ".p3m3-sample.txt");
const migDir = join(ROOT, "supabase/migrations");

const files = readFileSync(samplePath, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

function extractObjects(sql, file) {
  const objects = { tables: [], indexes: [], policies: [], functions: [], columns: [], views: [], types: [], triggers: [] };
  const s = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

  for (const m of s.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:public|auth)\.)?["']?(\w+)["']?/gi)) {
    objects.tables.push(m[1].toLowerCase());
  }
  for (const m of s.matchAll(/create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?["']?(\w+)["']?/gi)) {
    objects.indexes.push(m[1].toLowerCase());
  }
  for (const m of s.matchAll(/create\s+policy\s+["']?(\w+)["']?/gi)) {
    objects.policies.push(m[1].toLowerCase());
  }
  for (const m of s.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?["']?(\w+)["']?/gi)) {
    objects.functions.push(m[1].toLowerCase());
  }
  for (const m of s.matchAll(/create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?["']?(\w+)["']?/gi)) {
    objects.views.push(m[1].toLowerCase());
  }
  for (const m of s.matchAll(/create\s+type\s+(?:public\.)?["']?(\w+)["']?/gi)) {
    objects.types.push(m[1].toLowerCase());
  }
  for (const m of s.matchAll(/alter\s+table\s+(?:only\s+)?(?:(?:public)\.)?["']?(\w+)["']?\s+add\s+column\s+(?:if\s+not\s+exists\s+)?["']?(\w+)["']?/gi)) {
    objects.columns.push({ table: m[1].toLowerCase(), column: m[2].toLowerCase() });
  }
  for (const m of s.matchAll(/create\s+trigger\s+["']?(\w+)["']?/gi)) {
    objects.triggers.push(m[1].toLowerCase());
  }

  // dedupe
  for (const k of ["tables", "indexes", "policies", "functions", "views", "types", "triggers"]) {
    objects[k] = [...new Set(objects[k])];
  }
  return objects;
}

function hasStructuralOps(sql) {
  const s = sql.toLowerCase();
  return /create\s+(table|index|policy|function|view|type|trigger)|alter\s+table|drop\s+(table|index|policy|function|view|trigger|column)/.test(s);
}

function hasOnlyDataOrGrants(sql) {
  const s = sql.toLowerCase();
  const structural = hasStructuralOps(sql);
  const dataish = /\b(insert\s+into|update\s+|delete\s+from|grant\s+|revoke\s+|comment\s+on)\b/.test(s);
  return !structural && dataish;
}

const results = [];
const checks = [];

for (const file of files) {
  const path = join(migDir, file);
  let sql = "";
  try {
    sql = readFileSync(path, "utf8");
  } catch (e) {
    results.push({ file, error: String(e), objects: null });
    continue;
  }
  const objects = extractObjects(sql, file);
  const structural = hasStructuralOps(sql);
  const dataOnly = hasOnlyDataOrGrants(sql);
  const totalChecks =
    objects.tables.length +
    objects.indexes.length +
    objects.policies.length +
    objects.functions.length +
    objects.views.length +
    objects.types.length +
    objects.triggers.length +
    objects.columns.length;

  results.push({
    file,
    structural,
    dataOnly,
    totalChecks,
    objects,
    lines: sql.split(/\r?\n/).length,
  });

  const fid = file.replace(/[^a-z0-9]/gi, "_");
  for (const t of objects.tables) {
    checks.push({
      file,
      kind: "table",
      name: t,
      sql: `SELECT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='${t}' AND c.relkind IN ('r','p')) AS ok`,
    });
  }
  for (const ix of objects.indexes) {
    checks.push({
      file,
      kind: "index",
      name: ix,
      sql: `SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='${ix}') AS ok`,
    });
  }
  for (const p of objects.policies) {
    checks.push({
      file,
      kind: "policy",
      name: p,
      sql: `SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='${p}') AS ok`,
    });
  }
  for (const f of objects.functions) {
    checks.push({
      file,
      kind: "function",
      name: f,
      sql: `SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${f}') AS ok`,
    });
  }
  for (const v of objects.views) {
    checks.push({
      file,
      kind: "view",
      name: v,
      sql: `SELECT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='${v}' AND c.relkind IN ('v','m')) AS ok`,
    });
  }
  for (const ty of objects.types) {
    checks.push({
      file,
      kind: "type",
      name: ty,
      sql: `SELECT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='${ty}') AS ok`,
    });
  }
  for (const tr of objects.triggers) {
    checks.push({
      file,
      kind: "trigger",
      name: tr,
      sql: `SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname='${tr}') AS ok`,
    });
  }
  for (const col of objects.columns) {
    checks.push({
      file,
      kind: "column",
      name: `${col.table}.${col.column}`,
      sql: `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='${col.table}' AND column_name='${col.column}') AS ok`,
    });
  }
}

writeFileSync(join(ROOT, ".p3m3-parse.json"), JSON.stringify({ results, checks }, null, 2));

// Build batched verification query (chunks of 40)
const chunks = [];
for (let i = 0; i < checks.length; i += 40) {
  const slice = checks.slice(i, i + 40);
  const parts = slice.map(
    (c, j) =>
      `SELECT ${i + j} AS cid, '${c.file.replace(/'/g, "''")}' AS file, '${c.kind}' AS kind, '${c.name.replace(/'/g, "''")}' AS obj, (${c.sql}) AS ok`
  );
  chunks.push(parts.join("\nUNION ALL\n"));
}
writeFileSync(join(ROOT, ".p3m3-check-chunks.json"), JSON.stringify(chunks, null, 2));
console.log(`Parsed ${files.length} files, ${checks.length} checks, ${chunks.length} SQL chunks`);
