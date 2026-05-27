#!/usr/bin/env node
/**
 * K4 — Extract unique Supabase RPC names referenced in app/lib (excludes tests).
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "archive", ".git", "tests", "scripts"]);
const RPC_RE = /\.rpc\s*\(\s*["'`]([^"'`]+)["'`]/g;
const DYNAMIC_RPC_RE = /rpc(?:WithParamFallbacks)?\s*<[^>]*>\s*\(\s*["'`]([^"'`]+)["'`]/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (extname(p) === ".ts" || extname(p) === ".tsx") out.push(p);
  }
  return out;
}

const refs = new Map();

for (const file of walk(join(ROOT, "app"))) collect(file);
for (const file of walk(join(ROOT, "lib"))) collect(file);

function collect(file) {
  const text = readFileSync(file, "utf8");
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  for (const re of [RPC_RE, DYNAMIC_RPC_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const name = m[1].trim();
      if (!name || name.includes(" or ") || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) continue;
      if (!refs.has(name)) refs.set(name, []);
      const lines = refs.get(name);
      if (!lines.includes(rel)) lines.push(rel);
    }
  }
}

const names = [...refs.keys()].sort();
const payload = {
  scope: "app + lib (excludes tests/scripts)",
  count: names.length,
  rpcs: names,
  call_sites: Object.fromEntries([...refs.entries()].sort(([a], [b]) => a.localeCompare(b))),
};

const outPath = join(ROOT, "scripts", "audit", "k4-code-rpc-refs.json");
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${outPath} (${names.length} RPCs)`);
