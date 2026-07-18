#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DIR = path.join(ROOT, "docs/rc/phase17menu2b/market-dossiers");
const OUT = path.join(ROOT, "docs/rc/phase17menu2b/evidence");

const COUNTRIES = [
  "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
  "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
];

fs.mkdirSync(OUT, { recursive: true });
const rows = [];
let complete = 0;
for (const cc of COUNTRIES) {
  const p = path.join(DIR, `${cc}.json`);
  if (!fs.existsSync(p)) {
    rows.push({ country: cc, present: false, complete: false, shortfall: ["missing_file"] });
    continue;
  }
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  const price = d.price_observations?.length ?? d.completeness?.price_count ?? 0;
  const menu = d.menu_observations?.length ?? d.completeness?.menu_count ?? 0;
  const sources = d.sources?.length ?? d.completeness?.source_count ?? 0;
  const workplace = (d.sources ?? []).filter((s) => s.kind === "workplace").length;
  const commercial = (d.sources ?? []).filter((s) =>
    ["commercial", "economics"].includes(s.kind),
  ).length;
  const minPrice = cc === "US" ? 20 : cc === "CA" ? 25 : 12;
  const ok =
    price >= minPrice &&
    menu >= 12 &&
    sources >= 4 &&
    workplace >= 2 &&
    commercial >= 2 &&
    d.real_citations_only !== false;
  if (ok) complete += 1;
  rows.push({
    country: cc,
    present: true,
    price,
    menu,
    sources,
    workplace,
    commercial,
    complete: ok,
    shortfall: d.completeness?.shortfall ?? (ok ? [] : ["below_thresholds"]),
  });
}

const report = {
  COUNTRY_DOSSIERS: `${complete}/21`,
  COUNTRY_PRICE_EVIDENCE_COMPLETE: `${rows.filter((r) => (r.price ?? 0) >= (r.country === "US" ? 20 : r.country === "CA" ? 25 : 12)).length}/21`,
  COUNTRY_MENU_EVIDENCE_COMPLETE: `${rows.filter((r) => (r.menu ?? 0) >= 12).length}/21`,
  COUNTRY_DOSSIERS_WITHOUT_REAL_CITATIONS: rows.filter((r) => !r.present || r.complete === false).length,
  rows,
};
fs.writeFileSync(path.join(OUT, "market-dossiers-summary.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  COUNTRY_DOSSIERS: report.COUNTRY_DOSSIERS,
  COUNTRY_PRICE_EVIDENCE_COMPLETE: report.COUNTRY_PRICE_EVIDENCE_COMPLETE,
  COUNTRY_MENU_EVIDENCE_COMPLETE: report.COUNTRY_MENU_EVIDENCE_COMPLETE,
}, null, 2));
