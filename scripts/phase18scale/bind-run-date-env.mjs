#!/usr/bin/env node
/** Bind phase18-run-date-manifest.json into GITHUB_ENV. Fail closed if missing. */
import fs from "node:fs";
import { loadRunDateManifest } from "./lib/run-service-date.mjs";

const m = loadRunDateManifest();
const primary = m.PHASE18_PRIMARY_SERVICE_DATE;
const secondary = m.PHASE18_SECONDARY_SERVICE_DATE || "";
if (!process.env.GITHUB_ENV) {
  console.log(JSON.stringify({ bound_primary: primary, bound_secondary: secondary || null }));
  process.exit(0);
}
fs.appendFileSync(process.env.GITHUB_ENV, `PHASE18_RUN_SERVICE_DATE=${primary}\n`);
fs.appendFileSync(process.env.GITHUB_ENV, `PHASE18_PRIMARY_SERVICE_DATE=${primary}\n`);
fs.appendFileSync(process.env.GITHUB_ENV, `PHASE18_SERVICE_DATE=${primary}\n`);
if (secondary) fs.appendFileSync(process.env.GITHUB_ENV, `PHASE18_SECONDARY_SERVICE_DATE=${secondary}\n`);
console.log(JSON.stringify({ bound_primary: primary, bound_secondary: secondary || null }));
