#!/usr/bin/env node
/* =========================================================
   LUNCHPORTALEN — CI GUARD (HARD GATE)
   1) Forby SUPABASE_SERVICE_ROLE_KEY utenfor allowlist
   2) Forby direkte writes til orders utenfor tests/migrations
========================================================= */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const TEXT_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
  ".md",
  ".sql",
]);

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".vercel",
  "dist",
  "build",
  "coverage",
  ".turbo",
]);

// --- Allowlist: hvor service role er lov
// Juster disse om dere ønsker.
// Anbefalt: cron + superadmin system + supabase admin klient + workflows/migrations.
const SERVICE_ROLE_ALLOW_PREFIXES = [
  "lib/supabase/admin.ts",
  "lib/supabase/adminAny.ts", // om dere har den
  "app/api/cron/",
  "app/api/superadmin/system/",
  ".github/workflows/",
  "supabase/migrations/",
];

// --- Orders writes er kun lov i tests + migrations
const ORDERS_WRITE_ALLOW_PREFIXES = [
  "tests/",
  "supabase/migrations/",
];

// --- Patterns vi stopper
const SERVICE_ROLE_PATTERNS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "service_role", // grepper “service_role” som tekst
];

const ORDERS_WRITE_PATTERNS = [
  `.from("orders").insert`,
  `.from('orders').insert`,
  `.from("orders").update`,
  `.from('orders').update`,
  `.from("orders").upsert`,
  `.from('orders').upsert`,
  `.from("orders").delete`,
  `.from('orders').delete`,
];

function toRel(p) {
  return p.split(path.sep).join("/");
}

function isAllowedByPrefixes(rel, prefixes) {
  return prefixes.some((pre) => rel === pre || rel.startsWith(pre));
}

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (e.isFile()) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function looksTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!TEXT_EXTS.has(ext)) return false;
  return true;
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
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
  // 1-based line number
  let line = 1;
  for (let i = 0; i < idx && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

function snippet(text, idx, len = 140) {
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + len);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

const files = walk(ROOT).filter(looksTextFile);

const violations = [];

// Scan
for (const abs of files) {
  const rel = toRel(path.relative(ROOT, abs));
  const content = readFileSafe(abs);
  if (content == null) continue;

  // 1) Service role gate
  for (const pat of SERVICE_ROLE_PATTERNS) {
    const hits = findAllOccurrences(content, pat);
    if (!hits.length) continue;

    // Allowlisted?
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

  // 2) Orders write gate
  for (const pat of ORDERS_WRITE_PATTERNS) {
    const hits = findAllOccurrences(content, pat);
    if (!hits.length) continue;

    // Allowlisted?
    if (isAllowedByPrefixes(rel, ORDERS_WRITE_ALLOW_PREFIXES)) continue;

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

// Report
if (violations.length) {
  console.error("\n❌ CI GUARD FAILED — policy brudd funnet:\n");
  for (const v of violations) {
    console.error(
      `- [${v.type}] ${v.file}:${v.line}\n  pattern: ${v.pattern}\n  preview: ${v.preview}\n`
    );
  }
  console.error(
    "Fix:\n" +
      "• Flytt service-role bruk til allowlist (cron/superadmin-system/lib/supabase/admin.ts)\n" +
      "• Eller fjern det helt og bruk session-klient\n" +
      "• For orders: bruk DB RPC (lp_order_set/lp_order_cancel) – aldri direkte writes\n"
  );
  process.exit(1);
}

console.log("✅ CI GUARD PASSED — ingen policy-brudd funnet.");
process.exit(0);
