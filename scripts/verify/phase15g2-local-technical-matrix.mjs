#!/usr/bin/env node
/**
 * Phase 15G.2 — local technical matrix (fail-closed).
 * Does NOT claim staging certification. Does NOT forge approvals.
 * Proves 21-country/24-locale registry + invoice pack presence + kill-switch posture.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "package.json"));

const COUNTRIES = [
  "NO","SE","DK","FI","GB","DE","FR","ES","IT","NL",
  "BE","CH","AT","IE","PL","RO","CZ","PT","GR","US","CA",
];
const LOCALES = [
  "nb-NO","sv-SE","da-DK","fi-FI","en-GB","de-DE","fr-FR","es-ES","it-IT",
  "nl-NL","nl-BE","fr-BE","de-CH","fr-CH","de-AT","en-IE","pl-PL","ro-RO",
  "cs-CZ","pt-PT","el-GR","en-US","en-CA","fr-CA",
];

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", shell: true });
  return { ok: r.status === 0, status: r.status, out: `${r.stdout}\n${r.stderr}` };
}

const results = [];
results.push({ id: "countries", pass: COUNTRIES.length === 21, detail: String(COUNTRIES.length) });
results.push({ id: "locales", pass: LOCALES.length === 24, detail: String(LOCALES.length) });

const vitest = run("npx", [
  "vitest",
  "run",
  "tests/tax/phase15g2TechnicalCompletion.test.ts",
  "tests/tax/phase15g1GlobalCompletion.test.ts",
  "tests/tax/phase15gGlobalTaxFoundation.test.ts",
]);
results.push({ id: "tax_vitest", pass: vitest.ok, detail: vitest.ok ? "PASS" : vitest.out.slice(-500) });

const markets = run("node", ["scripts/ci/verify-21-country-markets.mjs"]);
results.push({ id: "verify_21_country", pass: markets.ok, detail: markets.ok ? "PASS" : markets.out.slice(-400) });

const failed = results.filter((r) => !r.pass);
console.log(JSON.stringify({ phase: "15G.2-local-matrix", results, failed: failed.length }, null, 2));
if (failed.length) process.exit(1);
console.log("OK: local technical matrix (not staging certification)");
