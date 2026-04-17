#!/usr/bin/env node
// HARD FAIL: onClick on <div> in mobile-critical surfaces only (S1.1 / header).
// Backoffice modals use div+onClick until migrated; they are out of scope here.
import fs from "node:fs";
import path from "node:path";
import { globSync } from "glob";

const ROOT = process.cwd();
const GLOBS = [
  "app/(public)/**/*.{tsx,jsx}",
  "app/(app)/home/**/*.{tsx,jsx}",
  "components/nav/**/*.{tsx,jsx}",
];
const BAD = /<div[^>]*\bonClick\s*=\s*\{/g;

let failed = false;
for (const g of GLOBS) {
  const hits = globSync(g, { cwd: ROOT, posix: true });
  for (const rel of hits) {
    const abs = path.join(ROOT, rel);
    const text = fs.readFileSync(abs, "utf8");
    BAD.lastIndex = 0;
    if (!BAD.test(text)) continue;
    console.error(`\n❌ UI SAFETY: <div onClick> forbidden in ${rel}\n`);
    failed = true;
  }
}

if (failed) {
  console.error("\n⛔ ui-clickable-div: use <button> or <Link>.\n");
  process.exit(1);
}

console.log("\n✅ ui-clickable-div: critical surfaces OK.\n");
