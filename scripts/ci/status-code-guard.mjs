#!/usr/bin/env node
// Static HTTP status semantics (deterministic, low false positives).
import fs from "node:fs";
import path from "node:path";
import { globSync } from "glob";

const ROOT = process.cwd();
const apiFiles = globSync("app/api/**/*.ts", { cwd: ROOT, posix: true }).map((f) => path.join(ROOT, f));

function read(p) {
  return fs.readFileSync(p, "utf8");
}

let failed = false;

for (const file of apiFiles) {
  const text = read(file);
  if (!text.includes("FEATURE_DISABLED")) continue;
  const re = /jsonErr\s*\([^;]{0,1200}?\)/gs;
  let m;
  while ((m = re.exec(text))) {
    const chunk = m[0];
    if (!chunk.includes("FEATURE_DISABLED")) continue;
    if (!/\b503\b/.test(chunk)) {
      console.error(`\n❌ STATUS GUARD: FEATURE_DISABLED must use HTTP 503 in jsonErr(...)\n   ${file}\n   ${chunk.slice(0, 240)}...\n`);
      failed = true;
    }
  }
}

const catchJsonErr200 = /catch\s*\([^)]*\)\s*\{[^}]{0,3500}?jsonErr\s*\([^)]*?\b200\b[^)]*\)/s;
for (const file of apiFiles) {
  const text = read(file);
  if (catchJsonErr200.test(text)) {
    console.error(`\n❌ STATUS GUARD: catch block uses jsonErr with HTTP 200 (forbidden)\n   ${file}\n`);
    failed = true;
  }
}

if (failed) {
  console.error("\n⛔ status-code-guard failed.\n");
  process.exit(1);
}

console.log("\n✅ status-code-guard: OK.\n");
