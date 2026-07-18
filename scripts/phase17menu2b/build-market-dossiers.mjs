#!/usr/bin/env node
/**
 * Phase 17MENU.2B — write real public market dossiers + EU summary.
 * Access date: 2026-07-18. No fabricated URLs/prices.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finalize } from "./helpers.mjs";
import { buildDeFr } from "./dossiers-de-fr.mjs";
import { buildEsItNlBe } from "./dossiers-es-it-nl-be.mjs";
import { buildChAt } from "./dossiers-ch-at.mjs";
import { buildPlRoCzPtGr } from "./dossiers-pl-ro-cz-pt-gr.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "docs/rc/phase17menu2b/market-dossiers");
const SUMMARY = path.join(ROOT, "docs/rc/phase17menu2b/evidence/market-dossiers-eu-summary.json");

const ORDER = ["DE", "FR", "ES", "IT", "NL", "BE", "CH", "AT", "PL", "RO", "CZ", "PT", "GR"];

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.dirname(SUMMARY), { recursive: true });

  const raw = {
    ...buildDeFr(),
    ...buildEsItNlBe(),
    ...buildChAt(),
    ...buildPlRoCzPtGr(),
  };

  const countries = [];
  for (const cc of ORDER) {
    if (!raw[cc]) throw new Error(`Missing dossier ${cc}`);
    const doc = finalize(raw[cc]);
    fs.writeFileSync(path.join(OUT, `${cc}.json`), `${JSON.stringify(doc, null, 2)}\n`, "utf8");
    countries.push({
      country_code: cc,
      currency: doc.currency,
      locales: doc.locales,
      price_count: doc.completeness.price_count,
      menu_count: doc.completeness.menu_count,
      source_count: doc.completeness.source_count,
      workplace_sources: doc.completeness.workplace_sources,
      commercial_sources: doc.completeness.commercial_sources,
      complete: doc.completeness.complete,
      shortfall: doc.completeness.shortfall,
    });
  }

  const complete = countries.filter((c) => c.complete).length;
  const summary = {
    access_date: "2026-07-18",
    phase: "17MENU.2B",
    real_citations_only: true,
    countries_total: ORDER.length,
    countries_complete: complete,
    countries_incomplete: ORDER.length - complete,
    totals: {
      price_observations: countries.reduce((s, c) => s + c.price_count, 0),
      menu_observations: countries.reduce((s, c) => s + c.menu_count, 0),
      sources: countries.reduce((s, c) => s + c.source_count, 0),
    },
    countries,
    note: "Honest shortfalls recorded where public unit prices or dish-level menus were scarce. BE/CH language regions encoded in geography fields only.",
  };
  fs.writeFileSync(SUMMARY, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        countries: ORDER.length,
        complete,
        incomplete: ORDER.length - complete,
        price_observations: summary.totals.price_observations,
        menu_observations: summary.totals.menu_observations,
        sources: summary.totals.sources,
        per_country: countries.map((c) => `${c.country_code}:${c.price_count}p/${c.menu_count}m/${c.source_count}s/${c.complete ? "OK" : "SHORT"}`),
      },
      null,
      2,
    ),
  );
}

main();
