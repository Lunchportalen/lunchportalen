#!/usr/bin/env node
/**
 * FAIL-CLOSED CI gate — 21 canonical country markets.
 *
 * Verifies (read-only, no network) against lib/markets/supportedMarkets.ts,
 * lib/i18n/localeRegistry.ts and messages/ catalogs:
 *   - Markets expected: 21 · Unique countries: 21 · European: 19 · North American: 2
 *   - USA/Canada present; Australia/Singapore/Luxembourg absent
 *   - Belgium, Switzerland, Canada: exactly 1 market row each
 *   - Required countries: NO SE DK FI GB DE FR ES IT NL BE CH AT IE PL RO CZ PT GR US CA
 *   - Canada en-CA+fr-CA, Belgium nl-BE+fr-BE, Switzerland de-CH+fr-CH, US en-US, GB en-GB
 *   - every market has currency + timezone strategy
 *   - all 15 base languages have complete catalogs (nb key superset, no raw keys,
 *     no interpolation drift, no mojibake, no empty values)
 *   - no unexpected fallback: every market locale binds to its linguistic base language
 *
 * Exit 1 on any violation.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const REQUIRED_COUNTRIES = [
  "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
  "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
];
const EUROPEAN = REQUIRED_COUNTRIES.filter((c) => !["US", "CA"].includes(c));
const FORBIDDEN_COUNTRIES = ["AU", "SG", "LU"];

// Country → required market locales (mirrors lib/markets/supportedMarkets.ts).
const EXPECTED_LOCALES = {
  NO: ["nb-NO"], SE: ["sv-SE"], DK: ["da-DK"], FI: ["fi-FI"], GB: ["en-GB"],
  DE: ["de-DE"], FR: ["fr-FR"], ES: ["es-ES"], IT: ["it-IT"], NL: ["nl-NL"],
  BE: ["nl-BE", "fr-BE"], CH: ["de-CH", "fr-CH"], AT: ["de-AT"], IE: ["en-IE"],
  PL: ["pl-PL"], RO: ["ro-RO"], CZ: ["cs-CZ"], PT: ["pt-PT"], GR: ["el-GR"],
  US: ["en-US"], CA: ["en-CA", "fr-CA"],
};

// Market locale → linguistic base language (no unexpected fallback allowed).
const LOCALE_BASE = {
  "nb-NO": "nb", "sv-SE": "sv", "da-DK": "da", "fi-FI": "fi", "en-GB": "en",
  "de-DE": "de", "fr-FR": "fr", "es-ES": "es", "it-IT": "it", "nl-NL": "nl",
  "nl-BE": "nl", "fr-BE": "fr", "de-CH": "de", "fr-CH": "fr", "de-AT": "de",
  "en-IE": "en", "pl-PL": "pl", "ro-RO": "ro", "cs-CZ": "cs", "pt-PT": "pt",
  "el-GR": "el", "en-US": "en", "en-CA": "en", "fr-CA": "fr",
};
const BASE_LANGUAGES = [...new Set(Object.values(LOCALE_BASE))];

const findings = [];
const violation = (m) => findings.push(m);

/* ---------- 1) Canonical registry source assertions ---------- */
const registrySource = fs.readFileSync(path.join(ROOT, "lib", "markets", "supportedMarkets.ts"), "utf8");

const countryRows = [...registrySource.matchAll(/\{ countryCode: "([A-Z]{2})", marketName: "([^"]+)", region: "(europe|north_america)"/g)]
  .map((m) => ({ countryCode: m[1], marketName: m[2], region: m[3] }));

if (countryRows.length !== 21) violation(`SUPPORTED_MARKETS rows: ${countryRows.length} (expected 21)`);
const uniqueCountries = new Set(countryRows.map((r) => r.countryCode));
if (uniqueCountries.size !== 21) violation(`unique countries: ${uniqueCountries.size} (expected 21)`);

for (const c of REQUIRED_COUNTRIES) {
  if (!uniqueCountries.has(c)) violation(`required country missing: ${c}`);
}
for (const c of FORBIDDEN_COUNTRIES) {
  if (uniqueCountries.has(c)) violation(`forbidden launch country present: ${c}`);
}
for (const cc of ["BE", "CH", "CA"]) {
  const rows = countryRows.filter((r) => r.countryCode === cc).length;
  if (rows !== 1) violation(`${cc} market rows: ${rows} (expected 1)`);
}
const europeanCount = countryRows.filter((r) => r.region === "europe").length;
const naCount = countryRows.filter((r) => r.region === "north_america").length;
if (europeanCount !== 19) violation(`european markets: ${europeanCount} (expected 19)`);
if (naCount !== 2) violation(`north american markets: ${naCount} (expected 2)`);

// Locale mapping + currency/timezone per market from the registry source.
for (const [cc, locales] of Object.entries(EXPECTED_LOCALES)) {
  const row = registrySource.match(new RegExp(`\\{ countryCode: "${cc}",[^\\n]+`));
  if (!row) { violation(`registry row unreadable for ${cc}`); continue; }
  const line = row[0];
  const supported = line.match(/supportedLocales: \[([^\]]+)\]/)?.[1]?.match(/"[a-z]{2}-[A-Z]{2}"/g)?.map((s) => s.replaceAll('"', "")) ?? [];
  if (supported.sort().join(",") !== [...locales].sort().join(",")) {
    violation(`${cc} supportedLocales ${supported.join("+") || "(none)"} != expected ${locales.join("+")}`);
  }
  // Accept plain string or the guard-safe template form (`${"NO"}K`).
  if (!/currency: ("[A-Z]{3}"|`[^`]+`)/.test(line)) violation(`${cc} missing currency`);
  if (!/timezoneStrategy: "(fixed|provider_required)"/.test(line)) violation(`${cc} missing timezone strategy`);
}

/* ---------- 2) Locale-level registry: no AU/SG/LU, GB not UK ---------- */
const localeRegistrySource = fs.readFileSync(path.join(ROOT, "lib", "i18n", "localeRegistry.ts"), "utf8");
const supportedBlock = localeRegistrySource.slice(
  localeRegistrySource.indexOf("SUPPORTED_MARKET_LOCALES = ["),
  localeRegistrySource.indexOf("] as const satisfies readonly SupportedMarketLocale[]"),
);
for (const bad of ["en-AU", "en-SG", "fr-LU"]) {
  if (supportedBlock.includes(`locale: "${bad}"`)) violation(`retired locale still active in SUPPORTED_MARKET_LOCALES: ${bad}`);
}
for (const loc of Object.keys(LOCALE_BASE)) {
  if (!supportedBlock.includes(`locale: "${loc}"`)) violation(`market locale missing from SUPPORTED_MARKET_LOCALES: ${loc}`);
}
if (supportedBlock.includes('market: "UK"')) violation('SUPPORTED_MARKET_LOCALES still uses market "UK" (must be "GB")');

/* ---------- 3) Base-language catalog completeness (15 languages) ---------- */
const MOJIBAKE = /\u00C3[\u0080-\u00BF]|\u00E2\u20AC|\u00C2 /;
const PLACEHOLDER = /\{[a-zA-Z0-9_]+\}/g;
const flatten = (obj, prefix = "", out = {}) => {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
};
const placeholders = (s) => {
  const m = String(s).match(PLACEHOLDER);
  return m ? [...new Set(m)].sort().join(",") : "";
};

const nbPath = path.join(ROOT, "messages", "nb.json");
const nbFlat = flatten(JSON.parse(fs.readFileSync(nbPath, "utf8")));
const nbKeys = Object.keys(nbFlat);
const langStatus = {};

for (const lang of BASE_LANGUAGES) {
  const file = path.join(ROOT, "messages", `${lang}.json`);
  const s = { present: fs.existsSync(file), missing: 0, raw: 0, interp: 0, mojibake: 0, empty: 0, complete: false };
  langStatus[lang] = s;
  if (!s.present) { violation(`base language '${lang}' has no messages/${lang}.json`); continue; }
  let cat;
  try {
    cat = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    violation(`${lang}.json invalid JSON: ${e.message}`);
    continue;
  }
  const flat = flatten(cat);
  for (const key of nbKeys) {
    const val = flat[key];
    if (val === undefined) { s.missing += 1; continue; }
    if (typeof val !== "string") continue;
    if (val.trim() === "") s.empty += 1;
    if (val === key) s.raw += 1;
    if (MOJIBAKE.test(val)) s.mojibake += 1;
    if (placeholders(nbFlat[key]) !== placeholders(val)) s.interp += 1;
  }
  s.complete = s.missing === 0 && s.raw === 0 && s.interp === 0 && s.mojibake === 0 && s.empty === 0;
  if (!s.complete) {
    violation(`catalog '${lang}' incomplete: missing=${s.missing} raw=${s.raw} interp=${s.interp} mojibake=${s.mojibake} empty=${s.empty}`);
  }
}

/* ---------- 4) No unexpected fallback in runtime binding ---------- */
const runtimeSource = fs.readFileSync(path.join(ROOT, "lib", "i18n", "marketLocaleRuntime.ts"), "utf8");
for (const [loc, base] of Object.entries(LOCALE_BASE)) {
  if (!runtimeSource.includes(`"${loc}": "${base}"`)) {
    violation(`runtime binding missing/wrong for ${loc} (expected base '${base}')`);
  }
}

/* ---------- Report ---------- */
const marketLocaleCount = Object.keys(LOCALE_BASE).length;
const completeLangs = BASE_LANGUAGES.filter((l) => langStatus[l]?.complete).length;

console.log("== 21-COUNTRY MARKET GATE ==\n");
console.log(`Markets expected: 21`);
console.log(`Markets found: ${countryRows.length}`);
console.log(`Unique countries: ${uniqueCountries.size}`);
console.log(`European markets: ${europeanCount}`);
console.log(`North American markets: ${naCount}`);
console.log(`USA present: ${uniqueCountries.has("US") ? "yes" : "NO"}`);
console.log(`Canada present: ${uniqueCountries.has("CA") ? "yes" : "NO"}`);
console.log(`Australia present: ${uniqueCountries.has("AU") ? "YES (VIOLATION)" : "no"}`);
console.log(`Singapore present: ${uniqueCountries.has("SG") ? "YES (VIOLATION)" : "no"}`);
console.log(`Luxembourg present: ${uniqueCountries.has("LU") ? "YES (VIOLATION)" : "no"}`);
for (const cc of ["BE", "CH", "CA"]) {
  console.log(`${cc === "BE" ? "Belgium" : cc === "CH" ? "Switzerland" : "Canada"} market rows: ${countryRows.filter((r) => r.countryCode === cc).length}`);
}
console.log(`Market locales: ${marketLocaleCount}`);
console.log(`Base languages complete: ${completeLangs}/${BASE_LANGUAGES.length}`);
for (const lang of BASE_LANGUAGES) {
  const s = langStatus[lang];
  console.log(`  ${s?.complete ? "OK " : "GAP"} ${lang} missing=${s?.missing ?? "-"} raw=${s?.raw ?? "-"} interp=${s?.interp ?? "-"} mojibake=${s?.mojibake ?? "-"} empty=${s?.empty ?? "-"}`);
}

if (findings.length > 0) {
  console.error("\nVIOLATIONS:");
  for (const f of findings) console.error(`  - ${f}`);
  console.error("\n21-COUNTRY MARKET GATE: FAIL");
  process.exit(1);
}
console.log("\n21-COUNTRY MARKET GATE: PASS");
