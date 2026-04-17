/**
 * Fail closed: lib/ai/_internalProvider.ts must only be imported from lib/ai/runner.ts.
 * Also rejects legacy lib/ai/provider imports (file removed).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "coverage"]);

/** Only application code — avoids false positives in ESLint config strings and this script’s comments. */
const SCAN_ROOTS = ["app", "lib", "tests"];

const EXT = /\.(ts|tsx)$/;

/** Normalize to forward slashes, strip leading ./ */
function norm(p) {
  return p.split(path.sep).join("/");
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (EXT.test(ent.name)) out.push(full);
  }
  return out;
}

const LEGACY = /['"]@\/lib\/ai\/provider['"]/;
const INTERNAL_ALIAS = /['"]@\/lib\/ai\/_internalProvider['"]/;
const INTERNAL_REL = /from\s+['"][^'"]*_internalProvider['"]|import\s*\(\s*['"][^'"]*_internalProvider['"]\s*\)/;

function isRunner(file) {
  return norm(path.relative(ROOT, file)) === "lib/ai/runner.ts";
}

const errors = [];

for (const rootName of SCAN_ROOTS) {
  const rootDir = path.join(ROOT, rootName);
  if (!fs.existsSync(rootDir)) continue;
  for (const file of walk(rootDir)) {
    scanFile(file);
  }
}

function scanFile(file) {
  const rel = norm(path.relative(ROOT, file));
  if (rel.startsWith("studio/")) return;

  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }

  if (LEGACY.test(text)) {
    errors.push(`${rel}: forbidden import of @/lib/ai/provider (use @/lib/ai/runner)`);
  }

  if (INTERNAL_ALIAS.test(text)) {
    errors.push(`${rel}: forbidden import of @/lib/ai/_internalProvider (only lib/ai/runner.ts may use ./_internalProvider)`);
  }

  if (!isRunner(file) && INTERNAL_REL.test(text)) {
    errors.push(`${rel}: forbidden import of _internalProvider (only lib/ai/runner.ts)`);
  }

  if (isRunner(file)) {
    if (!/from\s+['"]\.\/_internalProvider['"]/.test(text)) {
      errors.push(`${rel}: runner must import internal provider via from "./_internalProvider"`);
    }
  }
}

if (errors.length) {
  console.error("check-ai-internal-provider: FAIL\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}

console.log("check-ai-internal-provider: OK");
