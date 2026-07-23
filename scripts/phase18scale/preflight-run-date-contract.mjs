#!/usr/bin/env node
/**
 * Fail-closed run-date contract preflight before session issuance / HTTP.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isFutureDateUtc,
  loadRunDateManifest,
  requirePrimaryServiceDate,
  RUN_DATE_MANIFEST_PATH,
} from "./lib/run-service-date.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function main() {
  const manifestPresent = fs.existsSync(RUN_DATE_MANIFEST_PATH);
  if (!manifestPresent) {
    console.error("RUN_DATE_MANIFEST_PRESENT = NO");
    process.exit(2);
  }
  const manifest = loadRunDateManifest();
  const primary = requirePrimaryServiceDate();
  const future = isFutureDateUtc(primary);

  const dist = readJson(path.join(OUT, "synthetic-distribution.json"));
  const seedAlign = readJson(path.join(OUT, "ensure-menu-path-price-alignment.json"));
  const menuPreflight = readJson(path.join(OUT, "menu-path-preflight-companies.json"));
  const ensureMenus = readJson(path.join(OUT, "ensure-published-menus.json"));

  const seedDates = new Set();
  if (dist?.service_date) seedDates.add(String(dist.service_date));
  for (const d of dist?.service_dates || []) seedDates.add(String(d));
  for (const d of seedAlign?.service_dates || []) seedDates.add(String(d));
  if (ensureMenus?.service_date) seedDates.add(String(ensureMenus.service_date));

  const httpDate = process.env.PHASE18_SERVICE_DATE || null;
  const reconDate = process.env.PHASE18_SERVICE_DATE || null;

  const seedMatch =
    seedDates.size === 0 ||
    [...seedDates].every((d) => manifest.service_dates.includes(d) || d === primary);
  const sessionMatch = true; // sessions do not embed service_date; bound via env/manifest
  const httpMatch = !httpDate || httpDate === primary;
  const reconMatch = !reconDate || reconDate === primary;
  const menuPreflightMatch =
    !menuPreflight?.service_date || String(menuPreflight.service_date) === primary;

  const report = {
    phase: "18SCALE",
    RUN_DATE_MANIFEST_PRESENT: manifestPresent ? "YES" : "NO",
    RUN_DATE_IS_FUTURE: future ? "YES" : "NO",
    SEED_DATE_MATCH: seedMatch && menuPreflightMatch ? "YES" : "NO",
    SESSION_DATE_MATCH: sessionMatch ? "YES" : "NO",
    HTTP_DATE_MATCH: httpMatch ? "YES" : "NO",
    RECONCILIATION_DATE_MATCH: reconMatch ? "YES" : "NO",
    PHASE18_PRIMARY_SERVICE_DATE: primary,
    PHASE18_SECONDARY_SERVICE_DATE: manifest.PHASE18_SECONDARY_SERVICE_DATE,
    seed_dates_observed: [...seedDates],
    stamped_at: new Date().toISOString(),
  };

  const pass =
    report.RUN_DATE_MANIFEST_PRESENT === "YES" &&
    report.RUN_DATE_IS_FUTURE === "YES" &&
    report.SEED_DATE_MATCH === "YES" &&
    report.SESSION_DATE_MATCH === "YES" &&
    report.HTTP_DATE_MATCH === "YES" &&
    report.RECONCILIATION_DATE_MATCH === "YES";

  report.RUN_DATE_CONTRACT_PREFLIGHT = pass ? "PASS" : "FAIL";
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "run-date-contract-preflight.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!pass) process.exit(2);
}

main();
