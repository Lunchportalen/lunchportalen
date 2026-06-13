#!/usr/bin/env node
/**
 * CI gate: zero arbitrary design-token escapes in week/employee scope.
 * Mirrors eslint-rules/no-design-token-arbitrary.js patterns.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SCOPES = [
  "app/(app)/week",
  "components/employee",
];

const FORBIDDEN = [
  /rounded-\[(?!inherit\b)/,
  /shadow-\[/,
  /(?:^|\s)(?:bg|text|ring|border|from|to|via)-\[#/,
  /min-h-\[44px\]/,
  /(?:^|\s)(?:min-h|min-w|max-w|max-h|w|h|p|px|py|gap)-\[(?!var\(--)/,
];

const ALLOWED_TEXT = /text-\[(?:10|11)px\]/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function scanFile(file) {
  const content = fs.readFileSync(file, "utf8");
  const hits = [];
  const re =
    /className=\{`([^`]+)`\}|className="([^"]+)"|className='([^']+)'|(?:^|\s)(const\s+\w+\s*=\s*"([^"]+)";)/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    const raw = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
    const stripped = raw.replace(ALLOWED_TEXT, "");
    for (const pattern of FORBIDDEN) {
      if (pattern.test(stripped)) {
        hits.push({ file, snippet: raw.slice(0, 120), pattern: pattern.toString() });
        break;
      }
    }
  }
  return hits;
}

const files = SCOPES.flatMap((scope) => walk(path.join(ROOT, scope)));
const violations = files.flatMap(scanFile);

if (violations.length) {
  console.error("lint:design-tokens FAIL — arbitrary values in week/employee scope:\n");
  for (const v of violations) {
    console.error(`  ${path.relative(ROOT, v.file)}`);
    console.error(`    ${v.snippet}\n`);
  }
  process.exit(1);
}

console.log(`lint:design-tokens PASS (${files.length} files, 0 violations)`);
