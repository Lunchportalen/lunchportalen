#!/usr/bin/env node
/**
 * PHASE 17MENU.2B — Country specificity vs Norway and cross-market duplicates.
 * Translation-only differences do not count as specificity.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const BANKS = path.join(ROOT, "docs/rc/phase17menu2a/recipe-banks");
const OUT = path.join(ROOT, "docs/rc/phase17menu2b/evidence");

const COUNTRIES = [
  "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
  "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function structuralFingerprint(r) {
  const ings = (r.ingredients ?? [])
    .map((i) => String(i.ingredient_key ?? "").replace(/^[a-z]{2}-/i, ""))
    .sort()
    .join("|");
  const steps = (r.production?.steps ?? [])
    .map((s) =>
      String(s)
        .toLowerCase()
        .replace(/\b(bønner|beans|bønne|bohnen|haricots)\b/g, "PROTEIN")
        .replace(/\b(poteter|potatoes|kartoffeln|patatas)\b/g, "SIDE"),
    )
    .join(">");
  const mq = r.menu_quality ?? {};
  const payload = [
    mq.protein_main,
    mq.side,
    mq.sauce,
    mq.spice,
    mq.cuisine_style,
    ings,
    steps,
    r.yield?.portion_weight_g,
    r.production?.cooking_temperature_c,
  ].join("::");
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function loadBank(cc) {
  return JSON.parse(fs.readFileSync(path.join(BANKS, `${cc}.json`), "utf8"));
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function main() {
  ensureDir(OUT);
  const banks = Object.fromEntries(COUNTRIES.map((cc) => [cc, loadBank(cc)]));
  const fps = Object.fromEntries(
    COUNTRIES.map((cc) => [
      cc,
      banks[cc].recipes.map((r) => ({
        dish_key: r.dish_key,
        fp: structuralFingerprint(r),
        protein: r.menu_quality?.protein_main,
        style: r.menu_quality?.cuisine_style,
        veg: !!r.menu_quality?.vegetarian,
        local_terms: (r.ingredients ?? []).map((i) => i.local_name).filter(Boolean),
        season: r.menu_quality?.season ?? [],
        rationale: r.menu_quality?.local_relevance_rationale ?? "",
      })),
    ]),
  );

  const noFps = new Set(fps.NO.map((x) => x.fp));
  const countryReports = {};
  let norwayCloneCountries = 0;
  let unjustifiedDupes = 0;

  for (const cc of COUNTRIES) {
    const rows = fps[cc];
    const identicalToNo = rows.filter((r) => noFps.has(r.fp)).length;
    const similarityPct = Math.round((identicalToNo / rows.length) * 1000) / 10;
    const localCuisine = rows.filter((r) =>
      String(r.style ?? "").toLowerCase().includes(cc.toLowerCase()) ||
      String(r.rationale).toLowerCase().includes(cc.toLowerCase()) ||
      (cc === "NO" && /norsk|norway|nordisk/i.test(r.rationale)),
    ).length;
    const veg = rows.filter((r) => r.veg).length;
    const termCoverage = rows.filter((r) => r.local_terms.length >= 2).length;
    const seasonCov = rows.filter((r) => (r.season ?? []).length > 0).length;

    // Cross-country unjustified duplicates: same fp as another non-NO country without shared rationale keywords
    let crossDupes = 0;
    if (cc !== "NO") {
      for (const other of COUNTRIES) {
        if (other === cc || other === "NO") continue;
        const otherSet = new Set(fps[other].map((x) => x.fp));
        for (const r of rows) {
          if (otherSet.has(r.fp) && !/international|shared|global|common workplace/i.test(r.rationale)) {
            crossDupes += 1;
          }
        }
      }
      // de-dup count inflate: count unique fps that collide
      const collide = new Set();
      for (const other of COUNTRIES) {
        if (other === cc) continue;
        const otherSet = new Set(fps[other].map((x) => x.fp));
        for (const r of rows) {
          if (otherSet.has(r.fp)) collide.add(r.fp);
        }
      }
      crossDupes = collide.size;
    }

    const isNorwayClone = cc !== "NO" && similarityPct >= 85;
    if (isNorwayClone) norwayCloneCountries += 1;

    // Ingredient composition similarity vs NO (mean jaccard of stripped keys)
    const noIng = banks.NO.recipes.map((r) =>
      (r.ingredients ?? []).map((i) => String(i.ingredient_key ?? "").replace(/^[a-z]{2}-/i, "")),
    );
    const ccIng = banks[cc].recipes.map((r) =>
      (r.ingredients ?? []).map((i) => String(i.ingredient_key ?? "").replace(/^[a-z]{2}-/i, "")),
    );
    let jacSum = 0;
    const n = Math.min(noIng.length, ccIng.length);
    for (let i = 0; i < n; i++) jacSum += jaccard(noIng[i], ccIng[i]);
    const meanJac = n ? Math.round((jacSum / n) * 1000) / 10 : 0;

    countryReports[cc] = {
      local_or_adapted_recipes: rows.length - identicalToNo,
      norway_identical_structural: identicalToNo,
      similarity_pct_vs_norway_fingerprint: similarityPct,
      mean_ingredient_jaccard_vs_norway_pct: meanJac,
      local_terminology_coverage: termCoverage,
      local_seasonal_coverage: seasonCov,
      vegetarian_count: veg,
      local_cuisine_style_hits: localCuisine,
      unjustified_cross_country_duplicate_fps: crossDupes,
      norway_clone_flag: isNorwayClone,
      protein_style_distribution: rows.reduce((acc, r) => {
        const k = `${r.protein}|${r.style}`;
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {}),
    };
    unjustifiedDupes += countryReports[cc].unjustified_cross_country_duplicate_fps;
  }

  // Country-specific banks: not Norway clones and have local terminology
  const specificBanks = COUNTRIES.filter((cc) => {
    if (cc === "NO") return true;
    return !countryReports[cc].norway_clone_flag && countryReports[cc].local_terminology_coverage >= 40;
  }).length;

  const report = {
    phase: "17MENU.2B",
    audited_at: new Date().toISOString(),
    COUNTRY_SPECIFIC_RECIPE_BANKS: `${specificBanks}/21`,
    NORWAY_CLONE_COUNTRIES: norwayCloneCountries,
    UNJUSTIFIED_CROSS_COUNTRY_DUPLICATES: unjustifiedDupes,
    countries: countryReports,
    method:
      "Structural fingerprint strips country prefix from ingredient keys and normalizes common translations in steps. Display-title translation alone is ignored.",
  };

  fs.writeFileSync(path.join(OUT, "country-similarity-audit.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    COUNTRY_SPECIFIC_RECIPE_BANKS: report.COUNTRY_SPECIFIC_RECIPE_BANKS,
    NORWAY_CLONE_COUNTRIES: norwayCloneCountries,
    UNJUSTIFIED_CROSS_COUNTRY_DUPLICATES: unjustifiedDupes,
  }, null, 2));
  if (norwayCloneCountries > 0) process.exitCode = 1;
}

main();
