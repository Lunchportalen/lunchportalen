#!/usr/bin/env node
/* =========================================================
   AGENTS.md CI GATE — LUNCHPORTALEN (CI v2)
   - Hard, deterministic, maintainable
   - Blocks: date violations, Next15 dynamic API misuse,
             menu overflow clipping, API contract drift,
             multi-primary CTAs per page.
========================================================= */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// ---------------- Config ----------------
const INCLUDE_DIRS = ["app", "components", "lib", "scripts", "tests"];
const EXCLUDE_DIRS = new Set([
  ".next",
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
]);

const INCLUDE_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".css", ".md"]);

const PAGE_FILE_RE = /\/page\.(t|j)sx?$/;
const ROUTE_FILE_RE = /\/app\/api\/.*\/route\.(t|j)s$/;

// “Menu-like” files/areas we scan harder for overflow-hidden
const MENU_FILE_HINT_RE = /(ActionMenu|Dropdown|Menu|Popover|ContextMenu|Select|Radix|Portal)/i;
const MENU_PATH_HINT_RE = /(components\/.*(menu|dropdown|popover)|app\/.*(menu|dropdown|popover))/i;

// Neon + primary CTA checks
const NEON_CLASS = "lp-neon-glow-hover";
const PRIMARY_CLASS = "lp-btn-primary";

// ---------------- Helpers ----------------
function isExcluded(p) {
  const parts = p.split(path.sep);
  return parts.some((x) => EXCLUDE_DIRS.has(x));
}
function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (isExcluded(p)) continue;
    if (ent.isDirectory()) walk(p, out);
    else {
      const ext = path.extname(p);
      if (INCLUDE_EXT.has(ext)) out.push(p);
    }
  }
  return out;
}

const SKIP_SCRIPT_RE = /[\\/]+scripts[\\/]+/i;
function read(p) {
  return fs.readFileSync(p, "utf8");
}
function locFromIndex(text, idx) {
  const pre = text.slice(0, idx);
  const line = pre.split("\n").length;
  const col = pre.length - pre.lastIndexOf("\n");
  return { line, col };
}
function hardFail(msg) {
  console.error(`\n❌ AGENTS CI GATE FAILED:\n${msg}\n`);
  process.exitCode = 1;
}
function warn(msg) {
  console.warn(`\n⚠️  AGENTS CI GATE WARNING:\n${msg}\n`);
}

function reportMatches(kind, file, text, re, name, hint, hard) {
  re.lastIndex = 0;
  const matches = [...text.matchAll(re)];
  if (!matches.length) return;

  const header = `${kind}: ${name}\nFile: ${file}\nCount: ${matches.length}\nHint: ${hint}`;
  if (hard) hardFail(header);
  else warn(header);

  const max = Math.min(matches.length, 5);
  for (let i = 0; i < max; i++) {
    const m = matches[i];
    const at = locFromIndex(text, m.index ?? 0);
    console.log(`  - at line ${at.line}, col ${at.col}`);
  }
}

// ---------------- Gate 0: AGENTS.md exists ----------------
const agentsPath = path.join(ROOT, "AGENTS.md");
if (!fs.existsSync(agentsPath)) {
  hardFail("AGENTS.md is missing at repo root. This repo must include the project ground law file.");
  process.exit(1);
}

// ---------------- Collect files ----------------
const files = INCLUDE_DIRS
  .map((d) => path.join(ROOT, d))
  .filter((d) => fs.existsSync(d))
  .flatMap((d) => walk(d));

if (!files.length) {
  hardFail("No source files found to scan. Check INCLUDE_DIRS configuration.");
  process.exit(1);
}

// ---------------- v1 hard fails ----------------
const HARD_FAIL_PATTERNS = [
  {
    name: "UI date formatting via toLocaleDateString is forbidden (use lib/date/format.ts)",
    re: /\.toLocaleDateString\s*\(/g,
    hint: "Use formatDateNO / formatDateTimeNO from lib/date/format.ts. Backend remains ISO YYYY-MM-DD.",
  },
  {
    name: "Next.js 15: cookies() implicit casting is forbidden",
    re: /\bcookies\(\)\s*\.\s*toString\s*\(/g,
    hint: "Use: const c = await cookies(); then c.get(...). Never cast cookies() to string.",
  },
  {
    name: "Next.js 15: String(cookies()) is forbidden",
    re: /\bString\s*\(\s*cookies\(\)\s*\)/g,
    hint: "Use: const c = await cookies(); then c.get(...).",
  },
  {
    name: "Next.js 15: headers() implicit casting is forbidden",
    re: /\bheaders\(\)\s*\.\s*toString\s*\(/g,
    hint: "Use: const h = await headers(); then h.get(...). Never cast headers() to string.",
  },
  {
    name: "Next.js 15: String(headers()) is forbidden",
    re: /\bString\s*\(\s*headers\(\)\s*\)/g,
    hint: "Use: const h = await headers(); then h.get(...).",
  },
];

const WARN_PATTERNS = [
  {
    name: "Potential Next.js 15: headers().get(...) without awaiting headers() first",
    re: /\bheaders\(\)\s*\.\s*get\s*\(/g,
    hint: "Prefer: const h = await headers(); then h.get(...). Avoid headers().get(...) directly in server components.",
  },
  {
    name: "Clickable <div> risk: onClick on div (prefer button/link)",
    re: /<div[^>]*\bonClick\s*=\s*\{/g,
    hint: "Use <button> or <Link>. Avoid dead UI patterns.",
  },
];

// Run v1 patterns
for (const file of files) {
  if (SKIP_SCRIPT_RE.test(file)) continue;
  const text = read(file);
  for (const rule of HARD_FAIL_PATTERNS) {
    reportMatches("HARD FAIL", file, text, rule.re, rule.name, rule.hint, true);
  }
}
for (const file of files) {
  if (SKIP_SCRIPT_RE.test(file)) continue;
  const text = read(file);
  for (const rule of WARN_PATTERNS) {
    reportMatches("WARN", file, text, rule.re, rule.name, rule.hint, false);
  }
}

// ---------------- v2 gate #1: Menu overflow-hidden hard fail ----------------
// We only hard-fail overflow-hidden inside menu-related components/paths,
// to avoid false positives on legitimate image masks etc.
for (const file of files) {
  const rel = file.replace(ROOT, "");
  if (rel.replace(/\\/g, "/").includes("/scripts/")) continue;
  const text = read(file);

  const isMenuRelated =
    MENU_PATH_HINT_RE.test(rel) ||
    MENU_FILE_HINT_RE.test(text) ||
    /ActionMenu/i.test(rel);

  if (!isMenuRelated) continue;

  const re = /\boverflow-hidden\b/g;
  const matches = [...text.matchAll(re)];
  if (matches.length) {
    const name = "overflow-hidden is forbidden in dropdown/menu/popover (causes clipping & dead clicks)";
    const hint =
      "Remove overflow-hidden from menu panels. Use portal + z-index. If you need scroll, use max-h + overflow-auto on INNER list only.";
    reportMatches("HARD FAIL", file, text, re, name, hint, true);
  }
}

// ---------------- v2 gate #2: API contract gate for app/api/**/route.ts ----------------
// We enforce that each route file contains:
// - some 'rid' identifier (rid( or makeRid or requestId)
// - and returns/produces an object containing 'ok:' AND 'rid' in JSON
// This is intentionally pragmatic and high-confidence.
for (const file of files) {
  const norm = file.split(path.sep).join("/");
  if (!ROUTE_FILE_RE.test(norm)) continue;

  const text = read(file);

  const hasRidGen =
    /\brid\s*\(/.test(text) ||
    /\bmakeRid\b/.test(text) ||
    /\brequestId\b/.test(text) ||
    /\brid:\s*/.test(text);

  const usesRespondHelpers = /\bjsonOk\b/.test(text) && /\bjsonErr\b/.test(text);

  const isBinaryRoute =
    /Content-Type"\s*:\s*"application\/pdf"/.test(text) ||
    /Content-Type"\s*:\s*"text\/csv"/.test(text) ||
    /Content-Type"\s*:\s*"application\/octet-stream"/.test(text) ||
    /application\/pdf/.test(text) ||
    /text\/csv/.test(text);

  const hasOkRidInJson =
    /ok\s*:\s*true/.test(text) && /rid\s*:/.test(text);

  const hasOkFalse =
    /ok\s*:\s*false/.test(text);

  if (usesRespondHelpers) continue;
  if (isBinaryRoute && hasRidGen && /jsonErr/.test(text)) continue;

  if (!hasRidGen || !hasOkRidInJson || !hasOkFalse) {
    hardFail(
      `API CONTRACT VIOLATION in route.ts (must include ok:true/ok:false and rid).\n` +
        `File: ${file}\n` +
        `Required:\n` +
        ` - generate/use rid (rid()/makeRid/requestId)\n` +
        ` - include ok:true with rid in JSON response\n` +
        ` - include ok:false with rid in JSON response\n` +
        `Hint: Standardize responses to { ok, rid, data } / { ok:false, rid, error, message, status }.`
    );
  }
}

// ---------------- v2 gate #3: One primary CTA per page (hard fail) ----------------
// We count two signals in each page file:
// - occurrences of variant="primary" or variant={'primary'}
// - occurrences of class "lp-btn-primary"
// If either count > 1 => fail.
const primaryVariantRe = /\bvariant\s*=\s*["']primary["']|\bvariant\s*=\s*\{\s*["']primary["']\s*\}/g;

for (const file of files) {
  const rel = file.replace(ROOT, "");
  if (!PAGE_FILE_RE.test(rel)) continue;

  const text = read(file);

  const neonCount = (text.match(new RegExp(NEON_CLASS, "g")) || []).length;
  if (neonCount > 1) {
    hardFail(
      `NEON CTA RULE VIOLATION: more than one "${NEON_CLASS}" usage in a page file.\n` +
        `File: ${file}\nCount: ${neonCount}\n` +
        `Hint: Only ONE primary action per view may carry hot-pink glow.`
    );
  }

  const primaryClassCount = (text.match(new RegExp(PRIMARY_CLASS, "g")) || []).length;
  const primaryVariantCount = (text.match(primaryVariantRe) || []).length;

  if (primaryClassCount > 1 || primaryVariantCount > 1) {
    hardFail(
      `ONE PRIMARY CTA RULE VIOLATION in page file.\n` +
        `File: ${file}\n` +
        `lp-btn-primary count: ${primaryClassCount}\n` +
        `variant="primary" count: ${primaryVariantCount}\n` +
        `Hint: Exactly ONE primary CTA per view. Move other actions to secondary/ghost or overflow menu.`
    );
  }
}

if (process.exitCode === 1) {
  console.error("\n⛔ Fix the violations above. CI is blocked by AGENTS.md rules.\n");
  process.exit(1);
}

console.log("\n✅ AGENTS CI GATE PASSED (v2) — no blocking violations found.\n");
