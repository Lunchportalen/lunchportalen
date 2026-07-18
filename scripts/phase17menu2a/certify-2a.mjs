#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const E = path.join(ROOT, "docs/rc/phase17menu2a/evidence");
const BANKS = path.join(ROOT, "docs/rc/phase17menu2a/recipe-banks");
const COUNTRIES = [
  "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
  "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
];

function read(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function fail(m) {
  console.error(`FAIL: ${m}`);
  process.exit(1);
}

let recipes = 0;
for (const cc of COUNTRIES) {
  const bank = read(path.join(BANKS, `${cc}.json`));
  if (bank.recipes.length !== 55) fail(`${cc} recipes ${bank.recipes.length}`);
  for (const r of bank.recipes) {
    if (r.status !== "generation_eligible") fail(`${r.dish_key} not generation_eligible`);
    if (r.economics.commission_rate_bps !== 500) fail(`${r.dish_key} commission bps`);
    if (r.economics.commission_exact_numerator !== r.economics.provider_price_context_minor * 500) {
      fail(`${r.dish_key} commission numerator`);
    }
    if (!r.menu_quality.local_relevance_rationale) fail(`${r.dish_key} rationale`);
    recipes++;
  }
}

const spec = read(path.join(E, "country-specificity.json"));
if (spec.NORWAY_RECIPE_CLONE_COUNTRIES !== 0) fail("norway clones");
const adeq = read(path.join(E, "warm-bank-adequacy.json"));
if (adeq.WARM_BANKS_ADEQUATE !== "21/21") fail("adequacy");
if (adeq.DAYS_WITH_FEWER_THAN_THREE_ELIGIBLE_RECIPES !== 0) fail("days<3");
const gen = read(path.join(E, "live-warm-generation.json"));
if (gen.LIVE_WARM_GENERATION !== "21/21" || gen.WARM_DAYS_GENERATED !== 840) fail("generation");

console.log("PASS: COUNTRY_SPECIFIC_RECIPE_BANKS=21/21");
console.log("PASS: WARM_BANKS_ADEQUATE=21/21");
console.log("PASS: LIVE_WARM_GENERATION=21/21");
console.log(`PASS: recipes=${recipes}`);
console.log("PASS: phase17menu2a recipe/generation gates");
console.log("NOTE: HTTP package flows and LP_PACKAGE_ENTITLEMENTS_RUNTIME remain separate owner/credential gates");
