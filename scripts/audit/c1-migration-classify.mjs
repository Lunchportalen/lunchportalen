#!/usr/bin/env node
/**
 * C.1 migration classifier — reads every file in supabase/migrations (no pattern-only).
 * READ-ONLY audit artifact generator.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "supabase/migrations");
const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(".sql")).sort();

const KINDS = [
  "DDL",
  "DML",
  "GRANT",
  "RLS",
  "FUNCTION",
  "TRIGGER",
  "EXTENSION",
  "VIEW",
  "INDEX",
  "COMMENT",
  "MIXED",
];

function classify(content) {
  const u = content.toUpperCase();
  const tags = new Set();
  if (/\bCREATE\s+(OR\s+REPLACE\s+)?TABLE\b/i.test(content)) tags.add("DDL");
  if (/\bALTER\s+TABLE\b/i.test(content)) tags.add("DDL");
  if (/\bDROP\s+TABLE\b/i.test(content)) tags.add("DDL");
  if (/\bCREATE\s+(OR\s+REPLACE\s+)?VIEW\b/i.test(content)) tags.add("VIEW");
  if (/\bCREATE\s+(UNIQUE\s+)?INDEX\b/i.test(content)) tags.add("INDEX");
  if (/\bINSERT\s+INTO\b/i.test(content) || /\bUPDATE\s+\w+\s+SET\b/i.test(content) || /\bDELETE\s+FROM\b/i.test(content))
    tags.add("DML");
  if (/\bGRANT\b|\bREVOKE\b/i.test(content)) tags.add("GRANT");
  if (/\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b|\bCREATE\s+POLICY\b|\bDROP\s+POLICY\b/i.test(content)) tags.add("RLS");
  if (/\bCREATE\s+(OR\s+REPLACE\s+)?FUNCTION\b/i.test(content)) tags.add("FUNCTION");
  if (/\bCREATE\s+TRIGGER\b|\bDROP\s+TRIGGER\b/i.test(content)) tags.add("TRIGGER");
  if (/\bCREATE\s+EXTENSION\b/i.test(content)) tags.add("EXTENSION");
  if (/\bCOMMENT\s+ON\b/i.test(content)) tags.add("COMMENT");

  const kind = tags.size === 0 ? "DDL" : tags.size === 1 ? [...tags][0] : "MIXED";

  const risks = [];
  if (/\bDROP\s+\w+\s+CASCADE\b/i.test(content)) risks.push("DROP_CASCADE");
  if (/\bDELETE\s+FROM\s+\w+\s*;/i.test(content) && !/\bWHERE\b/i.test(content.split(/DELETE\s+FROM/i)[1]?.slice(0, 200) ?? ""))
    risks.push("DELETE_NO_WHERE");
  if (/\bALTER\s+TABLE\b/i.test(content) && !/\bACCESS\s+EXCLUSIVE\b/i.test(u) && /\bADD\s+COLUMN\b/i.test(content))
    risks.push("ALTER_ADD_COL_NO_LOCK_HINT");
  if (/\bSECURITY\s+DEFINER\b/i.test(content) && !/\bSET\s+search_path\b/i.test(content))
    risks.push("DEFINER_NO_SEARCH_PATH");
  if (/\bBEGIN\s*;/i.test(content) && !/\bCOMMIT\s*;/i.test(content)) risks.push("UNCOMMITTED_TX_BLOCK");

  const version = files.find ? null : null;
  return { kind, tags: [...tags], risks };
}

const rows = [];
const riskCounts = {};
const kindCounts = {};

for (const file of files) {
  const full = path.join(ROOT, file);
  const content = fs.readFileSync(full, "utf8");
  const { kind, tags, risks } = classify(content);
  kindCounts[kind] = (kindCounts[kind] ?? 0) + 1;
  for (const r of risks) riskCounts[r] = (riskCounts[r] ?? 0) + 1;
  const versionPrefix = file.replace(/_.*$/, "");
  const slug = file.replace(/^\d+_?/, "").replace(/\.sql$/, "");
  rows.push({
    file,
    versionPrefix,
    slug,
    bytes: content.length,
    lines: content.split(/\r?\n/).length,
    kind,
    tags,
    risks,
    opened: true,
  });
}

const out = {
  generated_at: new Date().toISOString(),
  migration_dir: ROOT,
  total_files: rows.length,
  kind_counts: kindCounts,
  risk_counts: riskCounts,
  rows,
};

const outPath = path.resolve(process.cwd(), ".tmp/c1-migration-classify.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log(JSON.stringify({ total: rows.length, kind_counts: kindCounts, risk_counts: riskCounts, artifact: outPath }));
