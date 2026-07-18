#!/usr/bin/env node
/**
 * PHASE 17MENU.2B — Audit all 1155 structured recipes (local banks = staging sync source).
 * Does not invent provenance. Classifies cost_basis honestly.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const BANKS = path.join(ROOT, "docs/rc/phase17menu2a/recipe-banks");
const OUT = path.join(ROOT, "docs/rc/phase17menu2b/evidence");

const COUNTRIES = [
  "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
  "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
];

const COMMISSION_RATE_BPS = 500;

function commissionExactNumerator(commissionableNetMinor) {
  const n = Number(commissionableNetMinor);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`INVALID_COMMISSIONABLE_NET:${commissionableNetMinor}`);
  }
  return n * COMMISSION_RATE_BPS;
}

const VALID_BASIS = new Set([
  "provider_actual",
  "supplier_catalog",
  "country_benchmark",
  "estimate_requiring_provider_review",
]);

const FABRICATED_MARKERS = [
  /public_catering_observation_/i,
  /synthesized/i,
  /example\.com/i,
  /lorem ipsum/i,
];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function missingFields(r) {
  const missing = [];
  const req = [
    "dish_key", "country_code", "recipe_version", "source_meal_idea_id",
    "locales", "status", "yield", "ingredients", "production", "delivery",
    "economics", "menu_quality",
  ];
  for (const f of req) {
    if (r[f] == null) missing.push(f);
  }
  const y = r.yield ?? {};
  for (const k of [
    "reference_batch", "finished_yield", "portion_weight_g",
    "trimming_loss_bps", "cooking_loss_bps", "expected_waste_bps",
  ]) {
    if (y[k] == null) missing.push(`yield.${k}`);
  }
  if (!Array.isArray(r.ingredients) || !r.ingredients.length) missing.push("ingredients.length");
  for (const ing of r.ingredients ?? []) {
    for (const k of [
      "ingredient_key", "local_name", "quantity_milli", "unit", "edible_yield_bps",
      "scaling", "cost_basis", "benchmark_source", "benchmark_date",
    ]) {
      if (ing[k] == null || ing[k] === "") missing.push(`ingredient:${ing.ingredient_key ?? "?"}:${k}`);
    }
    if (!VALID_BASIS.has(ing.cost_basis)) missing.push(`ingredient:${ing.ingredient_key}:invalid_cost_basis`);
  }
  const p = r.production ?? {};
  if (!Array.isArray(p.steps) || !p.steps.length) missing.push("production.steps");
  for (const k of [
    "active_labor_minutes", "passive_time_minutes", "equipment", "batch_limit",
    "holding_temperature_c", "maximum_hold_minutes",
  ]) {
    if (p[k] == null) missing.push(`production.${k}`);
  }
  const d = r.delivery ?? {};
  for (const k of [
    "packing_method", "maximum_transport_minutes", "transport_durability",
    "texture_risk", "reheating_suitability",
  ]) {
    if (d[k] == null) missing.push(`delivery.${k}`);
  }
  const e = r.economics ?? {};
  for (const k of [
    "ingredients_per_portion_minor", "packaging_minor", "labor_minor", "waste_minor",
    "energy_minor", "delivery_allocation_minor", "total_variable_cost_minor",
    "contribution_minor", "provider_price_context_minor", "currency", "cost_basis",
    "commission_rate_bps", "commission_exact_numerator",
  ]) {
    if (e[k] == null) missing.push(`economics.${k}`);
  }
  if (e.commission_rate_bps !== COMMISSION_RATE_BPS) missing.push("economics.commission_rate_bps_not_500");
  if (typeof e.provider_price_context_minor === "number" && typeof e.commission_exact_numerator === "number") {
    const expected = commissionExactNumerator(e.provider_price_context_minor);
    if (e.commission_exact_numerator !== expected) {
      missing.push(`economics.commission_numerator_mismatch:got=${e.commission_exact_numerator}:exp=${expected}`);
    }
  }
  const mq = r.menu_quality ?? {};
  for (const k of [
    "protein_main", "cuisine_style", "season", "spice", "color", "texture",
    "side", "sauce", "repeat_group", "local_relevance_rationale",
  ]) {
    if (mq[k] == null || mq[k] === "") missing.push(`menu_quality.${k}`);
  }
  if (!Array.isArray(r.locales) || !r.locales.length) missing.push("locales");
  return missing;
}

function main() {
  ensureDir(OUT);
  let audited = 0;
  let structurallyComplete = 0;
  let missingRequired = 0;
  let unverifiedEstimates = 0;
  let providerActual = 0;
  let supplierCatalog = 0;
  let countryBenchmark = 0;
  let fabricatedSources = 0;
  let fabricatedCitations = 0;
  const perCountry = {};
  const sampleMissing = [];

  for (const cc of COUNTRIES) {
    const bank = JSON.parse(fs.readFileSync(path.join(BANKS, `${cc}.json`), "utf8"));
    const recipes = Array.isArray(bank.recipes) ? bank.recipes : [];
    let ccComplete = 0;
    let ccMissing = 0;
    for (const r of recipes) {
      audited += 1;
      const miss = missingFields(r);
      if (miss.length) {
        missingRequired += 1;
        ccMissing += 1;
        if (sampleMissing.length < 25) {
          sampleMissing.push({ dish_key: r.dish_key, missing: miss.slice(0, 12) });
        }
      } else {
        structurallyComplete += 1;
        ccComplete += 1;
      }
      const bases = new Set([
        r.economics?.cost_basis,
        ...(r.ingredients ?? []).map((i) => i.cost_basis),
      ].filter(Boolean));
      if (bases.has("provider_actual")) providerActual += 1;
      if (bases.has("supplier_catalog")) supplierCatalog += 1;
      if (bases.has("country_benchmark")) countryBenchmark += 1;
      if (bases.has("estimate_requiring_provider_review")) unverifiedEstimates += 1;
      const blob = JSON.stringify(r);
      for (const re of FABRICATED_MARKERS) {
        if (re.test(blob)) {
          if (/observation|synthesized|lorem|example\.com/i.test(re.source)) fabricatedCitations += 1;
          else fabricatedSources += 1;
          break;
        }
      }
    }
    perCountry[cc] = {
      recipes: recipes.length,
      structurally_complete: ccComplete,
      missing_required: ccMissing,
    };
  }

  const report = {
    phase: "17MENU.2B",
    audited_at: new Date().toISOString(),
    source: "docs/rc/phase17menu2a/recipe-banks",
    RECIPES_AUDITED: `${audited}/1155`,
    RECIPES_STRUCTURALLY_COMPLETE: structurallyComplete,
    RECIPES_WITH_MISSING_REQUIRED_FIELDS: missingRequired,
    RECIPES_WITH_UNVERIFIED_ESTIMATES: unverifiedEstimates,
    RECIPES_WITH_PROVIDER_ACTUAL_COSTS: providerActual,
    RECIPES_WITH_SUPPLIER_OR_CATALOG: supplierCatalog,
    RECIPES_WITH_COUNTRY_BENCHMARKS: countryBenchmark,
    FABRICATED_COST_SOURCES: fabricatedSources,
    FABRICATED_RECIPE_CITATIONS: fabricatedCitations,
    per_country: perCountry,
    sample_missing: sampleMissing,
    note:
      "Technical generation eligibility may use country_benchmark / estimate_requiring_provider_review. Provider publication still requires provider review. No invented supplier URLs.",
  };

  fs.writeFileSync(path.join(OUT, "recipe-quality-audit.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(OUT, "recipe-provenance-audit.json"),
    JSON.stringify(
      {
        provider_actual: providerActual,
        supplier_catalog: supplierCatalog,
        country_benchmark: countryBenchmark,
        estimate_requiring_provider_review: unverifiedEstimates,
        fabricated_cost_sources: fabricatedSources,
        fabricated_recipe_citations: fabricatedCitations,
        provenance_rule:
          "PROVIDER_ACTUAL | SUPPLIER_OR_CATALOG | COUNTRY_BENCHMARK | ESTIMATE_REQUIRING_PROVIDER_REVIEW",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({
    RECIPES_AUDITED: report.RECIPES_AUDITED,
    RECIPES_STRUCTURALLY_COMPLETE: structurallyComplete,
    RECIPES_WITH_MISSING_REQUIRED_FIELDS: missingRequired,
    FABRICATED_COST_SOURCES: fabricatedSources,
    FABRICATED_RECIPE_CITATIONS: fabricatedCitations,
  }, null, 2));
  if (audited !== 1155) process.exit(1);
}

main();
