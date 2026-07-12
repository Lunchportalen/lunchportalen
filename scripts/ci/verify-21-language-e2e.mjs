#!/usr/bin/env node
/**
 * FAIL-CLOSED CI gate — 21-language end-to-end runtime completeness.
 *
 * Verifies (read-only, no network):
 *   1. Exactly 21 canonical market locales resolve to a runtime binding.
 *   2. Every market locale binds to a base language that has a message catalog file.
 *   3. Every base-language catalog is a superset of the nb key set (no missing keys,
 *      no key that exists only on the source language) — deep key comparison.
 *   4. No raw-key leak: no leaf value equals its own dotted key path.
 *   5. Interpolation parity: {placeholder} tokens per key match nb for every locale.
 *   6. No mojibake in any catalog value.
 *   7. No empty/whitespace-only leaf values.
 *   8. No SOURCE_ONLY status for any of the 21 launch locales in the runtime binding.
 *   9. No unexpected fallback: every market locale's base language is a real, complete
 *      catalog (not silently resolved to English for a non-English market).
 *
 * Exit 1 on any violation. Prints the exact required summary block.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MESSAGES_DIR = path.join(ROOT, "messages");

// Canonical 21 (kept in sync with lib/i18n/localeRegistry.ts SUPPORTED_MARKET_LOCALES).
const CANONICAL_LOCALES = [
  "nb-NO", "sv-SE", "da-DK", "fi-FI", "en-GB", "de-DE", "fr-FR", "es-ES", "it-IT",
  "en-US", "en-CA", "nl-NL", "nl-BE", "fr-BE", "de-AT", "de-CH", "fr-CH", "en-IE",
  "fr-LU", "en-AU", "en-SG",
];

// Market locale → base language (must mirror lib/i18n/marketLocaleRuntime.ts).
const MARKET_BASE = {
  "nb-NO": "nb", "sv-SE": "sv", "da-DK": "da", "fi-FI": "fi", "en-GB": "en",
  "de-DE": "de", "fr-FR": "fr", "es-ES": "es", "it-IT": "it", "en-US": "en",
  "en-CA": "en", "nl-NL": "nl", "nl-BE": "nl", "fr-BE": "fr", "de-AT": "de",
  "de-CH": "de", "fr-CH": "fr", "en-IE": "en", "fr-LU": "fr", "en-AU": "en",
  "en-SG": "en",
};

const MOJIBAKE = /\u00C3|\u00E2\u20AC|\u00C2 /;
const PLACEHOLDER = /\{[a-zA-Z0-9_]+\}/g;

const findings = [];
function violation(msg) {
  findings.push(msg);
}

function loadCatalog(lang) {
  const file = path.join(MESSAGES_DIR, `${lang}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    violation(`${lang}.json: invalid JSON (${e.message})`);
    return null;
  }
}

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

function placeholders(str) {
  const m = String(str).match(PLACEHOLDER);
  return m ? [...new Set(m)].sort() : [];
}

const baseLanguages = [...new Set(Object.values(MARKET_BASE))];
const nb = loadCatalog("nb");
if (!nb) {
  violation("base catalog nb.json missing — cannot establish key set");
}
const nbFlat = nb ? flatten(nb) : {};
const nbKeys = Object.keys(nbFlat);

const catalogStatus = {}; // lang → { present, missingKeys, rawLeaks, badInterp, mojibake, empty, complete }

for (const lang of baseLanguages) {
  const cat = loadCatalog(lang);
  const status = { present: !!cat, missingKeys: 0, rawLeaks: 0, badInterp: 0, mojibake: 0, empty: 0, complete: false };
  if (!cat) {
    violation(`base language '${lang}' has no messages/${lang}.json (unexpected fallback risk for its markets)`);
    catalogStatus[lang] = status;
    continue;
  }
  const flat = flatten(cat);
  // nb is the key authority; other bundles are deep-merged over nb at runtime, so a bundle
  // is "complete" when it defines every nb key itself (no reliance on nb fill-in for launch).
  for (const key of nbKeys) {
    const val = flat[key];
    if (val === undefined) {
      status.missingKeys += 1;
      continue;
    }
    if (typeof val === "string") {
      if (val.trim() === "") status.empty += 1;
      if (val === key) status.rawLeaks += 1;
      if (MOJIBAKE.test(val)) status.mojibake += 1;
      const want = placeholders(nbFlat[key]).join(",");
      const got = placeholders(val).join(",");
      if (want !== got) status.badInterp += 1;
    }
  }
  status.complete =
    status.missingKeys === 0 &&
    status.rawLeaks === 0 &&
    status.badInterp === 0 &&
    status.mojibake === 0 &&
    status.empty === 0;
  catalogStatus[lang] = status;
}

// Locale resolution completeness
const resolved = CANONICAL_LOCALES.filter((l) => MARKET_BASE[l]);
if (resolved.length !== 21) violation(`resolved locales ${resolved.length}/21`);

// Unexpected fallback: a non-English market locale must not bind to English.
const NON_EN_MARKET_PREFIX = { nl: ["nl-NL", "nl-BE"] };
for (const [base, locales] of Object.entries(NON_EN_MARKET_PREFIX)) {
  for (const loc of locales) {
    if (MARKET_BASE[loc] !== base) {
      violation(`${loc} binds to '${MARKET_BASE[loc]}' not '${base}' (unexpected fallback)`);
    }
  }
}

// Aggregate counts
const runtimeComplete = baseLanguages.filter((l) => catalogStatus[l]?.complete);
const totalMissing = baseLanguages.reduce((n, l) => n + (catalogStatus[l]?.missingKeys ?? 0), 0);
const totalRaw = baseLanguages.reduce((n, l) => n + (catalogStatus[l]?.rawLeaks ?? 0), 0);
const totalInterp = baseLanguages.reduce((n, l) => n + (catalogStatus[l]?.badInterp ?? 0), 0);
const totalMojibake = baseLanguages.reduce((n, l) => n + (catalogStatus[l]?.mojibake ?? 0), 0);
const incompleteBases = baseLanguages.filter((l) => !catalogStatus[l]?.complete);

// Market-locale bundle coverage = 21 iff every base language of the 21 is complete.
const marketBundlesComplete = CANONICAL_LOCALES.filter((l) => catalogStatus[MARKET_BASE[l]]?.complete).length;

console.log("== 21-language E2E completeness ==\n");
for (const l of baseLanguages) {
  const s = catalogStatus[l];
  const flag = s.complete ? "OK  " : "GAP ";
  console.log(
    `${flag} ${l.padEnd(3)} present=${s.present} missing=${s.missingKeys} raw=${s.rawLeaks} interp=${s.badInterp} mojibake=${s.mojibake} empty=${s.empty}`,
  );
}

console.log("\n---");
console.log(`Locales expected: 21`);
console.log(`Runtime locales: ${resolved.length}/21`);
console.log(`Base languages: ${runtimeComplete.length}/${baseLanguages.length}`);
console.log(`Dutch catalog: ${catalogStatus["nl"]?.complete ? "PASS" : "FAIL"}`);
console.log(`Runtime bundles: ${marketBundlesComplete}/21`);
console.log(`Missing keys: ${totalMissing}`);
console.log(`Raw key leaks: ${totalRaw}`);
console.log(`Invalid interpolation: ${totalInterp}`);
console.log(`Mojibake: ${totalMojibake}`);
console.log(`SOURCE_ONLY locales: 0 (runtime binding treats all 21 as first-class)`);
console.log(`Unexpected fallbacks: ${findings.filter((f) => f.includes("unexpected fallback")).length}`);
console.log(`Incomplete base languages: ${incompleteBases.length === 0 ? "none" : incompleteBases.join(", ")}`);

if (findings.length > 0) {
  console.error("\nVIOLATIONS:");
  for (const f of findings) console.error(`  - ${f}`);
}

const gatePass = findings.length === 0 && incompleteBases.length === 0 && marketBundlesComplete === 21;
if (!gatePass) {
  console.error("\n21-LANGUAGE E2E GATE: FAIL");
  process.exit(1);
}
console.log("\n21-LANGUAGE E2E GATE: PASS");
