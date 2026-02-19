#!/usr/bin/env node
/**
 * CSS AUDIT — finn lp- klasser brukt i repo som IKKE finnes definert i globals.css
 *
 * Kjør:
 *   node scripts/css-audit-lp-missing.mjs app/globals.css
 *
 * Valgfritt:
 *   node scripts/css-audit-lp-missing.mjs app/globals.css --json
 *   node scripts/css-audit-lp-missing.mjs app/globals.css --verbose
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const args = process.argv.slice(2);

/* -------------------------------------------------------
   Argument parsing
------------------------------------------------------- */
const jsonMode = args.includes("--json");
const verboseMode = args.includes("--verbose");

const cssArg = args.find((a) => !a.startsWith("--"));
const globalsPath = cssArg
  ? path.resolve(cssArg)
  : path.join(ROOT, "app", "globals.css");

/* -------------------------------------------------------
   Helpers
------------------------------------------------------- */
function stableRel(p) {
  return path.relative(ROOT, p).split(path.sep).join("/");
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function extractCssDefinedLpClasses(css) {
  /**
   * Matcher:
   *   .lp-foo { ... }
   *   .lp-foo:hover { ... }
   *   .lp-foo, .lp-bar { ... }
   */
  const re = /\.lp-[a-zA-Z0-9_-]+/g;
  const matches = css.match(re) ?? [];

  const out = new Set();
  for (const m of matches) {
    const cls = m.slice(1).split(":")[0];
    out.add(cls);
  }
  return out;
}

function runAuditJson() {
  try {
    const raw = execSync(
      "node scripts/css-audit-lp-classes.mjs --json",
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }
    ).toString("utf8");

    return JSON.parse(raw);
  } catch (err) {
    console.error("❌ Klarte ikke kjøre css-audit-lp-classes.mjs");
    console.error("Sørg for at scriptet finnes i /scripts.");
    process.exit(1);
  }
}

/* -------------------------------------------------------
   Main
------------------------------------------------------- */

const css = readFileSafe(globalsPath);

if (!css) {
  console.error(`❌ Fant ikke globals.css på: ${globalsPath}`);
  console.error("Kjør f.eks:");
  console.error("  node scripts/css-audit-lp-missing.mjs app/globals.css");
  process.exit(1);
}

const defined = extractCssDefinedLpClasses(css);
const audit = runAuditJson();

if (!audit || !Array.isArray(audit.classes)) {
  console.error("❌ Ugyldig JSON fra css-audit-lp-classes.mjs");
  process.exit(1);
}

const used = new Set(audit.classes.map((c) => c.class));

const missing = Array.from(used)
  .filter((cls) => !defined.has(cls))
  .sort((a, b) => a.localeCompare(b));

const unusedDefined = Array.from(defined)
  .filter((cls) => !used.has(cls))
  .sort((a, b) => a.localeCompare(b));

/* -------------------------------------------------------
   Output
------------------------------------------------------- */

if (jsonMode) {
  const payload = {
    globals: stableRel(globalsPath),
    totals: {
      used: used.size,
      defined: defined.size,
      missing: missing.length,
      unusedDefined: unusedDefined.length,
    },
    missing,
    ...(verboseMode ? { unusedDefined } : {}),
  };

  process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
  process.exit(0);
}

console.log("\n==============================================");
console.log("CSS AUDIT — lp- class coverage");
console.log("==============================================\n");

console.log(`globals.css: ${stableRel(globalsPath)}\n`);

console.log(`Used in repo:     ${used.size}`);
console.log(`Defined in CSS:   ${defined.size}`);
console.log(`Missing:          ${missing.length}`);
console.log(`Unused defined:   ${unusedDefined.length}\n`);

if (missing.length) {
  console.log("---- MISSING (brukt men ikke definert) ----\n");
  for (const m of missing) console.log(m);
  console.log("");
} else {
  console.log("✔ Ingen manglende lp- klasser.\n");
}

if (verboseMode && unusedDefined.length) {
  console.log("---- UNUSED (definert men ikke brukt) ----\n");
  for (const u of unusedDefined) console.log(u);
  console.log("");
}

console.log("Tips:");
console.log("  node scripts/css-audit-lp-missing.mjs app/globals.css --json");
console.log("  node scripts/css-audit-lp-missing.mjs app/globals.css --verbose\n");
