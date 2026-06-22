#!/usr/bin/env node
/**
 * Commercial hardcode inventory guard — ADR-017 R2.
 * Read-only: fails when new commercial hardcodes appear outside the allowlist.
 *
 * Usage:
 *   node scripts/ci/commercial-hardcodes-guard.mjs
 *   node scripts/ci/commercial-hardcodes-guard.mjs --update-allowlist
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const ALLOWLIST_PATH = path.join(ROOT, "scripts/ci/commercial-hardcodes-allowlist.json");

const SCAN_ROOTS = ["app", "lib", "components"];

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  "test-results",
  "playwright-report",
  "playwright-provider-meny-visual-report",
  ".git",
  "dist",
  "coverage",
]);

const SKIP_PATH_PREFIXES = [
  "lib/commercial/marketConfigs.ts",
  "lib/commercial/moneyDisplay.ts",
  "scripts/ci/commercial-hardcodes-guard.mjs",
  "scripts/ci/commercial-hardcodes-guard.test.mjs",
  "scripts/ci/commercial-hardcodes-allowlist.json",
];

const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/** Pattern ids — aligned with R1 commercial inventory. */
export const COMMERCIAL_HARDCODE_PATTERNS = [
  { id: "NOK", re: /\bNOK\b/g },
  { id: "formatNok", re: /formatNok|fmtNOK|moneyNOKExVat|formatNokCompact|unitPriceNOK/g },
  { id: "VAT_RATE", re: /VAT_RATE/g },
  { id: "vat_0_15", re: /0\.15/g },
  { id: "cents_9000", re: /\b9000\b/g },
  { id: "cents_13000", re: /\b13000\b/g },
  { id: "cents_17000", re: /\b17000\b/g },
  { id: "price_per_meal_nok", re: /price_per_meal_nok/g },
  { id: "price_per_employee", re: /price_per_employee/g },
  { id: "Tripletex", re: /Tripletex/g },
  { id: "EHF", re: /\bEHF\b/g },
  { id: "ehf_0192", re: /0192/g },
  { id: "COMMISSION_RATE", re: /LUNCHPORTALEN_COMMISSION_RATE/g },
  { id: "gross_only", re: /gross_only/g },
];

function normalizeRel(p) {
  return p.replace(/\\/g, "/");
}

function shouldSkipFile(rel) {
  const n = normalizeRel(rel);
  if (SKIP_PATH_PREFIXES.some((p) => n === p || n.endsWith(`/${p}`))) return true;
  if (n.includes("/_ci-baselines")) return true;
  if (n.includes("/_baseline-")) return true;
  return false;
}

function walkDir(absDir, relDir, files) {
  if (!fs.existsSync(absDir)) return;
  for (const name of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (name.isDirectory()) {
      if (SKIP_DIR_NAMES.has(name.name)) continue;
      walkDir(path.join(absDir, name.name), path.join(relDir, name.name), files);
      continue;
    }
    const ext = path.extname(name.name);
    if (!CODE_EXTS.has(ext)) continue;
    const rel = normalizeRel(path.join(relDir, name.name));
    if (shouldSkipFile(rel)) continue;
    files.push(rel);
  }
}

/**
 * @returns {string[]} sorted unique keys `path:line:patternId`
 */
export function scanCommercialHardcodes() {
  const files = [];
  for (const root of SCAN_ROOTS) {
    walkDir(path.join(ROOT, root), root, files);
  }

  const keys = new Set();

  for (const rel of files.sort()) {
    const abs = path.join(ROOT, rel);
    const content = fs.readFileSync(abs, "utf8");
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { id, re } of COMMERCIAL_HARDCODE_PATTERNS) {
        re.lastIndex = 0;
        if (re.test(line)) {
          keys.add(`${rel}:${i + 1}:${id}`);
        }
      }
    }
  }

  return [...keys].sort();
}

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) return [];
  const raw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf8"));
  return Array.isArray(raw.entries) ? raw.entries.sort() : [];
}

function writeAllowlist(entries) {
  const payload = {
    description:
      "Allowlisted commercial hardcode occurrences from R1 inventory. Update via --update-allowlist when intentionally adding legacy NO commercial code.",
    entries,
  };
  fs.writeFileSync(ALLOWLIST_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

/**
 * @param {{ update?: boolean }} [opts]
 */
export function runCommercialHardcodesGuard(opts = {}) {
  const found = scanCommercialHardcodes();
  const allowlisted = loadAllowlist();
  const allowSet = new Set(allowlisted);

  const unexpected = found.filter((k) => !allowSet.has(k));
  const stale = allowlisted.filter((k) => !found.includes(k));

  if (opts.update) {
    writeAllowlist(found);
    return {
      ok: true,
      mode: "update",
      count: found.length,
      unexpected: [],
      stale,
    };
  }

  return {
    ok: unexpected.length === 0,
    mode: "check",
    count: found.length,
    allowlistedCount: allowlisted.length,
    unexpected,
    stale,
  };
}

function main() {
  const update = process.argv.includes("--update-allowlist");
  const result = runCommercialHardcodesGuard({ update });

  if (result.mode === "update") {
    console.log(`✅ commercial-hardcodes-allowlist updated: ${result.count} entries`);
    if (result.stale.length > 0) {
      console.log(`   removed ${result.stale.length} stale allowlist entries`);
    }
    return;
  }

  if (result.ok) {
    console.log(
      `✅ commercial-hardcodes-guard: OK (${result.count} known occurrences, ${result.allowlistedCount} allowlisted)`,
    );
    if (result.stale.length > 0) {
      console.warn(`⚠️  ${result.stale.length} stale allowlist entries (run --update-allowlist to prune)`);
    }
    return;
  }

  console.error(`❌ commercial-hardcodes-guard: ${result.unexpected.length} new occurrence(s) outside allowlist`);
  for (const key of result.unexpected.slice(0, 50)) {
    console.error(`   + ${key}`);
  }
  if (result.unexpected.length > 50) {
    console.error(`   … and ${result.unexpected.length - 50} more`);
  }
  console.error("   Fix: remove hardcode, or add to allowlist via intentional R1 legacy update (--update-allowlist).");
  process.exit(1);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
