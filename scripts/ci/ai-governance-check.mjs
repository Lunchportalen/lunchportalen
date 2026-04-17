#!/usr/bin/env node
// AI routes: disabled gate uses 503; failures must not claim ok:true in catch.
import fs from "node:fs";
import path from "node:path";
import { globSync } from "glob";

const ROOT = process.cwd();
const aiRoots = ["app/api/ai", "app/api/backoffice/ai"];
const files = aiRoots.flatMap((dir) => {
  const p = path.join(ROOT, dir);
  if (!fs.existsSync(p)) return [];
  return globSync(`${dir}/**/*.ts`, { cwd: ROOT, posix: true }).map((f) => path.join(ROOT, f));
});

function read(p) {
  return fs.readFileSync(p, "utf8");
}

let failed = false;

for (const file of files) {
  const text = read(file);
  if (file.includes("backoffice/ai") && /!isAIEnabled\s*\(\s*\)/.test(text) && !/FEATURE_DISABLED/.test(text)) {
    console.error(`\n❌ AI GOVERNANCE: backoffice AI route uses !isAIEnabled() but missing FEATURE_DISABLED\n   ${file}\n`);
    failed = true;
  }

  const catchOkTrue = /catch\s*\([^)]*\)\s*\{[^}]{0,4000}?\bok\s*:\s*true\b/s;
  if (catchOkTrue.test(text)) {
    console.error(`\n❌ AI GOVERNANCE: catch block must not return ok:true (silent success)\n   ${file}\n`);
    failed = true;
  }
}

if (failed) {
  console.error("\n⛔ ai-governance-check failed.\n");
  process.exit(1);
}

console.log(`\n✅ ai-governance-check: ${files.length} file(s) OK.\n`);
