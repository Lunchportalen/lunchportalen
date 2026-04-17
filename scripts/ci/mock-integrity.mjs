#!/usr/bin/env node
// Prevent destructive vi.mock patterns on critical modules.
import fs from "node:fs";
import path from "node:path";
import { globSync } from "glob";

const ROOT = process.cwd();
const tests = globSync("tests/**/*.{test.ts,test.tsx}", { cwd: ROOT, posix: true }).map((f) => path.join(ROOT, f));

function read(p) {
  return fs.readFileSync(p, "utf8");
}

let failed = false;

for (const file of tests) {
  const text = read(file);
  const norm = file.split(path.sep).join("/");

  if (/vi\.mock\s*\(\s*import\s*\(\s*["']@\/lib\/supabase\/admin["']\s*\)/.test(text)) {
    if (!/importOriginal/.test(text)) {
      console.error(`\n❌ MOCK INTEGRITY: supabase admin mock missing importOriginal\n   ${norm}\n`);
      failed = true;
    }
    if (!/\.\.\.\s*actual/.test(text) && !/\.\.\.actual/.test(text)) {
      console.error(`\n❌ MOCK INTEGRITY: supabase admin mock must spread ...actual from importOriginal()\n   ${norm}\n`);
      failed = true;
    }
    if (!/hasSupabaseAdminConfig/.test(text)) {
      console.error(`\n❌ MOCK INTEGRITY: supabase admin mock must preserve hasSupabaseAdminConfig\n   ${norm}\n`);
      failed = true;
    }
  }

  if (/vi\.mock\s*\(\s*import\s*\(\s*["']@\/lib\/orders\/rpcWrite["']\s*\)/.test(text)) {
    if (!/importOriginal/.test(text)) {
      console.error(`\n❌ MOCK INTEGRITY: rpcWrite mock must use importOriginal\n   ${norm}\n`);
      failed = true;
    }
    if (!/\.\.\.\s*actual/.test(text) && !/\.\.\.actual/.test(text)) {
      console.error(`\n❌ MOCK INTEGRITY: rpcWrite mock must spread ...actual (preserves normalizeOrderTableSlot)\n   ${norm}\n`);
      failed = true;
    }
  }
}

const rpcWrite = path.join(ROOT, "lib", "orders", "rpcWrite.ts");
if (!fs.existsSync(rpcWrite) || !read(rpcWrite).includes("normalizeOrderTableSlot")) {
  console.error("\n❌ MOCK INTEGRITY: lib/orders/rpcWrite.ts must export normalizeOrderTableSlot\n");
  failed = true;
}
const adminMod = path.join(ROOT, "lib", "supabase", "admin.ts");
if (!fs.existsSync(adminMod) || !read(adminMod).includes("hasSupabaseAdminConfig")) {
  console.error("\n❌ MOCK INTEGRITY: lib/supabase/admin.ts must export hasSupabaseAdminConfig\n");
  failed = true;
}

if (failed) {
  console.error("\n⛔ mock-integrity failed.\n");
  process.exit(1);
}

console.log(`\n✅ mock-integrity: ${tests.length} test file(s) scanned.\n`);
