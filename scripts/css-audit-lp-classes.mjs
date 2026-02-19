#!/usr/bin/env node
/**
 * CSS AUDIT — list unike lp- klasser brukt i repo
 * - Leser .ts .tsx .js .jsx .mdx .css .html .json
 * - Ignorerer node_modules, .next, dist, build, coverage, .git, out
 * - Returnerer sortert liste + count per klasse
 *
 * Kjør:
 *   node scripts/css-audit-lp-classes.mjs
 *   node scripts/css-audit-lp-classes.mjs --json
 *
 * Tips:
 *   node scripts/css-audit-lp-classes.mjs --json > lp-classes.json
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".git",
  "out",
  ".vercel",
  ".turbo",
]);

const EXT_OK = new Set([".ts", ".tsx", ".js", ".jsx", ".mdx", ".css", ".html", ".json"]);

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const includeFiles = args.has("--files"); // ekstra: skriver filer per klasse i tekstmodus også
const maxFilesPerClass = (() => {
  const v = [...args].find((a) => a.startsWith("--max-files="));
  if (!v) return 20;
  const n = Number(v.split("=")[1]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
})();

function shouldIgnoreDir(name) {
  return IGNORE_DIRS.has(name);
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const ent of entries) {
    const p = path.join(dir, ent.name);

    if (ent.isDirectory()) {
      if (shouldIgnoreDir(ent.name)) continue;
      walk(p, out);
      continue;
    }

    const ext = path.extname(ent.name).toLowerCase();
    if (!EXT_OK.has(ext)) continue;
    out.push(p);
  }

  return out;
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function extractLpClasses(text) {
  /**
   * Fanger lp-xxxx (tillater a-zA-Z0-9_-)
   * - Tar ikke med pseudo-ting som :hover (match stopper før :)
   * - Eks: "lp-card:focus-within" -> "lp-card"
   */
  const re = /\blp-[a-zA-Z0-9_-]+\b/g;
  const found = text.match(re) ?? [];
  return found;
}

function stableRel(p) {
  return path.relative(ROOT, p).split(path.sep).join("/");
}

const files = walk(ROOT);

const counts = new Map(); // class -> count
const sources = new Map(); // class -> Set(files)

for (const f of files) {
  const txt = readFileSafe(f);
  if (!txt) continue;

  const hits = extractLpClasses(txt);
  if (!hits.length) continue;

  for (const cls of hits) {
    counts.set(cls, (counts.get(cls) ?? 0) + 1);
    if (!sources.has(cls)) sources.set(cls, new Set());
    sources.get(cls).add(stableRel(f));
  }
}

const all = Array.from(counts.entries())
  .map(([cls, count]) => ({
    class: cls,
    count,
    files: Array.from(sources.get(cls) ?? []).sort(),
  }))
  .sort((a, b) => a.class.localeCompare(b.class));

if (asJson) {
  process.stdout.write(JSON.stringify({ total: all.length, classes: all }, null, 2) + "\n");
  process.exit(0);
}

// Tekstmodus
console.log(`\nCSS AUDIT — lp- classes (${all.length} unike)\n`);
for (const row of all) {
  console.log(`${row.class}  (${row.count})`);
  if (includeFiles) {
    const list = row.files.slice(0, maxFilesPerClass);
    for (const f of list) console.log(`  - ${f}`);
    if (row.files.length > list.length) console.log(`  … +${row.files.length - list.length} flere`);
  }
}
console.log("");
console.log("Tips:");
console.log("  node scripts/css-audit-lp-classes.mjs --json");
console.log("  node scripts/css-audit-lp-classes.mjs --files --max-files=15");
console.log("");
