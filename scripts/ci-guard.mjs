#!/usr/bin/env node
/* =========================================================
   LUNCHPORTALEN - CI GUARD (HARD GATE)
   1) Forby service-role env-key utenfor allowlist
   2) Forby direkte writes til orders i produksjonskode
========================================================= */

import fs from "node:fs";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";

const ROOT = process.cwd();

const SERVICE_ROLE_ALLOW_PREFIXES = [
  "lib/supabase/admin.ts",
  "app/api/cron/",
  "app/api/superadmin/",
  "app/api/system/",
  "tests/",
  "supabase/migrations/",
  ".github/workflows/",
];

const SERVICE_ROLE_CODE_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
]);

const ORDERS_WRITE_SCAN_PREFIXES = [
  "app/",
  "lib/",
  "components/",
  "scripts/",
];

const ORDERS_WRITE_CODE_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

const SERVICE_ROLE_PATTERNS = [
  ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"),
];

const ORDERS_FROM_PATTERNS = [
  `.from("orders")`,
  `.from('orders')`,
];
const ORDERS_WRITE_METHODS = [
  ".insert",
  ".update",
  ".upsert",
  ".delete",
];
const ORDERS_WRITE_PATTERNS = ORDERS_FROM_PATTERNS.flatMap((p) =>
  ORDERS_WRITE_METHODS.map((m) => `${p}${m}`)
);

const MOJIBAKE_MARKDOWN_PATTERN = "\u00C3|\u00E2\u20AC\u2013|\u00E2\u20AC\u2014|\u00E2\u20AC\u2122|\u00E2\u20AC\u0153|\u00E2\u20AC\u009D|\u00C2 ";
const MOJIBAKE_DOCS_ARGS = ["-n", MOJIBAKE_MARKDOWN_PATTERN, "docs", "-g", "**/*.md"];

function toRel(p) {
  return p.split(path.sep).join("/");
}

function isAllowedByPrefixes(rel, prefixes) {
  return prefixes.some((pre) => rel === pre || rel.startsWith(pre));
}

function listTrackedFiles() {
  const out = execSync("git ls-files -z", { cwd: ROOT, encoding: "buffer" });
  return out
    .toString("utf8")
    .split("\0")
    .map((x) => x.trim())
    .filter(Boolean)
    .map(toRel);
}

function shouldScanServiceRole(rel) {
  if (rel.toLowerCase().endsWith(".md")) return false;
  if (rel.startsWith("supabase/migrations/")) return path.extname(rel).toLowerCase() === ".sql";
  if (rel.startsWith(".github/workflows/")) return true;
  return SERVICE_ROLE_CODE_EXTS.has(path.extname(rel).toLowerCase());
}

function shouldScanOrdersWrite(rel) {
  if (!ORDERS_WRITE_SCAN_PREFIXES.some((pre) => rel.startsWith(pre))) return false;
  if (rel.startsWith("docs/")) return false;
  if (rel.toLowerCase().endsWith(".md")) return false;
  return ORDERS_WRITE_CODE_EXTS.has(path.extname(rel).toLowerCase());
}

function readTrackedFileSafe(rel) {
  try {
    return fs.readFileSync(path.join(ROOT, rel), "utf8");
  } catch {
    return null;
  }
}

function findAllOccurrences(haystack, needle) {
  const idxs = [];
  let i = 0;
  while (true) {
    const j = haystack.indexOf(needle, i);
    if (j === -1) break;
    idxs.push(j);
    i = j + needle.length;
  }
  return idxs;
}

function lineOfIndex(text, idx) {
  let line = 1;
  for (let i = 0; i < idx && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function snippet(text, idx, len = 140) {
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + len);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function runMojibakeMarkdownGuard() {
  const checks = [{ label: "docs markdown", args: MOJIBAKE_DOCS_ARGS }];
  let found = false;

  for (const check of checks) {
    const res = spawnSync("rg", check.args, { cwd: ROOT, encoding: "utf8" });

    if (res.error || (res.status !== 0 && res.status !== 1)) {
      console.error(`CI GUARD FAILED - mojibake check error (${check.label}).`);
      if (res.error) console.error(String(res.error));
      if (res.stderr) process.stderr.write(res.stderr);
      process.exit(1);
    }

    if (res.status === 0) {
      found = true;
      console.error(`- [MOJIBAKE_MARKDOWN] ${check.label}`);
      if (res.stdout) process.stderr.write(res.stdout);
    }
  }

  if (found) {
    console.error("\nCI GUARD FAILED - mojibake funnet i docs markdown.\n");
    process.exit(1);
  }
}

const files = listTrackedFiles();
const violations = [];

for (const rel of files) {
  const content = readTrackedFileSafe(rel);
  if (content == null) continue;

  if (shouldScanServiceRole(rel)) {
    for (const pat of SERVICE_ROLE_PATTERNS) {
      const hits = findAllOccurrences(content, pat);
      if (!hits.length) continue;
      if (isAllowedByPrefixes(rel, SERVICE_ROLE_ALLOW_PREFIXES)) continue;

      for (const idx of hits) {
        violations.push({
          type: "SERVICE_ROLE_NOT_ALLOWED",
          file: rel,
          line: lineOfIndex(content, idx),
          pattern: pat,
          preview: snippet(content, idx),
        });
      }
    }
  }

  if (shouldScanOrdersWrite(rel)) {
    for (const pat of ORDERS_WRITE_PATTERNS) {
      const hits = findAllOccurrences(content, pat);
      if (!hits.length) continue;

      for (const idx of hits) {
        violations.push({
          type: "ORDERS_DIRECT_WRITE_NOT_ALLOWED",
          file: rel,
          line: lineOfIndex(content, idx),
          pattern: pat,
          preview: snippet(content, idx),
        });
      }
    }
  }
}

if (violations.length) {
  console.error("\nCI GUARD FAILED - policy brudd funnet:\n");
  for (const v of violations) {
    console.error(
      `- [${v.type}] ${v.file}:${v.line}\n  pattern: ${v.pattern}\n  preview: ${v.preview}\n`
    );
  }
  console.error(
    "Fix:\n" +
      "- Flytt service-role bruk til allowlist og bruk lib/supabase/admin.ts\n" +
      "- Bruk RPC for order writes (ikke direkte writes)\n"
  );
  process.exit(1);
}

runMojibakeMarkdownGuard();

console.log("CI GUARD PASSED - ingen policy-brudd funnet.");
process.exit(0);
