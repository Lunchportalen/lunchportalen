#!/usr/bin/env node
/**
 * Delete lib/ai files not in keep-closure (FASE D).
 * Usage: node scripts/audit/lib-ai-delete-archive.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dryRun = process.argv.includes("--dry-run");
const closure = JSON.parse(
  fs.readFileSync(path.join(ROOT, "scripts/audit/lib-ai-keep-closure.json"), "utf8"),
);
const keepSet = new Set(closure.keepFiles);

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, o);
    else if (e.name.endsWith(".ts") || e.name === ".gitkeep") o.push(f);
  }
  return o;
}

const aiRoot = path.join(ROOT, "lib/ai");
const toDelete = walk(aiRoot).filter((f) => {
  const rel = f.split(path.sep).join("/").replace(/.*\/lib\/ai\//, "");
  return !keepSet.has(rel);
});

console.log(`Delete ${toDelete.length} files (${dryRun ? "dry-run" : "live"})`);

if (dryRun) {
  toDelete.slice(0, 20).forEach((f) => console.log(" ", path.relative(ROOT, f)));
  if (toDelete.length > 20) console.log(`  ... and ${toDelete.length - 20} more`);
  process.exit(0);
}

for (const f of toDelete) {
  fs.rmSync(f, { force: true });
}

// Remove empty dirs
function rmEmpty(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) rmEmpty(path.join(dir, e.name));
  }
  if (dir !== aiRoot && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}
rmEmpty(aiRoot);

console.log("Done. Remaining:", walk(aiRoot).length);
