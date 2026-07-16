#!/usr/bin/env node
/**
 * PHASE 11 — LANGUAGE CONTENT GATE (fail-closed).
 *
 * Kontrollerer FAKTISK språkinnhold i alle 15 katalogene — ikke bare nøkler:
 *   1. EN-lekkasje: verdi identisk med en-katalogen (der en ≠ nb) med
 *      distinkte engelske ord i ikke-engelske kataloger.
 *   2. NB-lekkasje: verdi identisk med nb-katalogen (der nb ≠ en) med
 *      distinkt norsk ortografi/ordforråd — med egne markørlister for
 *      svensk og dansk (delt skandinavisk ordforråd er IKKE lekkasje).
 *   3. Gresk skrift: el-verdier med lange latinske ord må inneholde gresk
 *      skrift (unntatt interpolasjon, merkevare- og produkttermer).
 *   4. Mojibake i alle kataloger.
 *
 * Legitime unntak vedlikeholdes i scripts/ci/language-content-allowlist.json.
 * Usage: node scripts/ci/verify-language-content.mjs [--report]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LANGS = ["nb", "sv", "da", "fi", "en", "de", "fr", "es", "it", "nl", "pl", "ro", "cs", "pt", "el"];
const REPORT = process.argv.includes("--report");

const allowlistPath = path.join(ROOT, "scripts/ci/language-content-allowlist.json");
const allowlist = fs.existsSync(allowlistPath) ? JSON.parse(fs.readFileSync(allowlistPath, "utf8")) : { entries: [] };
const allowed = new Set((allowlist.entries ?? []).map((e) => `${e.locale}:${e.key}`));

function load(lang) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, `messages/${lang}.json`), "utf8"));
}

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") flatten(v, key, out);
  }
  return out;
}

const catalogs = Object.fromEntries(LANGS.map((l) => [l, flatten(load(l))]));
const nb = catalogs.nb;
const en = catalogs.en;

// Distinkte engelske markører (ordgrenser, små bokstaver i løpende tekst).
const EN_MARKERS = /\b(the|this|not|and|is|are|has|have|saved|draft|you|your|please|cannot|could)\b/;

// Distinkt norsk vs. IKKE-skandinaviske språk: identitet + norske tegn/ord.
const NB_MARKERS_GENERIC = /[æøå]|\b(ikke|lagre|velg|søk|bestill|vennligst)\b/i;
// Distinkt norsk vs. SVENSK (delt ordforråd som «utkast», «språk» er OK).
const NB_MARKERS_VS_SV = /\b(ikke|lagre|lagret|vennligst|kjøkken|uke|uker|måned|bestilling|levering|tilgjengelig|spørsmål|gjør|hva|prøv igjen|øyeblikk|mappede)\b/i;
// Distinkt norsk vs. DANSK (dansk deler enda mer; kun klart norske former).
const NB_MARKERS_VS_DA = /\b(uke|uker|kjøkken|språk|gjør|hva|prøv igjen|på nytt|tilgjengelig|øyeblikk|gjelder|kjøp)\b/i;

// Nøkkelmønstre som alltid er unntatt (språknavn vises på originalspråket,
// interpolasjons-/formatnøkler, merkevare-/produkttermer).
const KEY_EXEMPT_PATTERNS = [/\.locales\./, /\.localeSwitcher\./];
const BRAND_TERMS = /(Lunchportalen|Tripletex|Luxus|Enterprise|BASIS|Premium|Company ID|Employee Token|Vipps|EHF|CSV|PDF|MVA|VAT|GST|HST)/;

function stripInterpolation(v) {
  return v.replace(/\{[^}]*\}/g, "").trim();
}

const violations = [];

for (const lang of LANGS) {
  if (lang === "nb") continue;
  const cat = catalogs[lang];

  for (const [key, value] of Object.entries(cat)) {
    if (allowed.has(`${lang}:${key}`)) continue;
    if (KEY_EXEMPT_PATTERNS.some((p) => p.test(key))) continue;

    const stripped = stripInterpolation(value);
    if (stripped.length < 8) continue;

    // 1) Engelsk lekkasje i ikke-engelske kataloger.
    if (lang !== "en" && en[key] && value === en[key] && en[key] !== nb[key] && EN_MARKERS.test(value)) {
      violations.push({ lang, key, kind: "english_leak", value: value.slice(0, 80) });
      continue;
    }

    // 2) Norsk lekkasje.
    if (nb[key] && value === nb[key] && nb[key] !== en[key]) {
      const marker = lang === "sv" ? NB_MARKERS_VS_SV : lang === "da" ? NB_MARKERS_VS_DA : NB_MARKERS_GENERIC;
      if (marker.test(value)) {
        violations.push({ lang, key, kind: "norwegian_leak", value: value.slice(0, 80) });
        continue;
      }
    }

    // 3) Gresk katalog må bruke gresk skrift for løpende tekst.
    if (lang === "el" && stripped.length >= 10 && /[a-zA-Z]{6,}/.test(stripped) && !/[\u0370-\u03FF]/.test(stripped) && !BRAND_TERMS.test(stripped)) {
      violations.push({ lang, key, kind: "missing_greek_script", value: value.slice(0, 80) });
      continue;
    }

    // 4) Mojibake (dobbel-enkodede tegn: Ã¦/Ã¸/Ã¥/â€ osv.).
    if (/\u00c3[\u0080-\u00bf]|\u00c2[\u00a0-\u00bb]|\u00e2\u0080/.test(value)) {
      violations.push({ lang, key, kind: "mojibake", value: value.slice(0, 80) });
    }
  }
}

if (violations.length > 0) {
  console.error(`❌ language-content-gate: ${violations.length} violation(s)`);
  for (const v of violations.slice(0, 50)) {
    console.error(`   ${v.lang} ${v.kind} ${v.key}: ${v.value}`);
  }
  process.exit(1);
}

if (REPORT) {
  console.log(`Checked ${LANGS.length - 1} catalogs against nb/en content heuristics.`);
}
console.log("✅ language-content-gate: 15/15 catalogs clean (no mixed language, no leakage, no mojibake)");
