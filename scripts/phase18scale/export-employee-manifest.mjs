#!/usr/bin/env node
/**
 * Export employee-manifest.ndjson from DB (profiles + companies) for session/load waves.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { loadPhase18Env, assertNotProduction } from "./load-env.mjs";
import { localeForEmployeeIndex } from "./lib/matrix.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const DB_CONTAINER = process.env.PHASE18_DB_CONTAINER || "supabase_db_lunchportalen";

function main() {
  const { url } = loadPhase18Env();
  assertNotProduction(url);
  fs.mkdirSync(OUT, { recursive: true });
  const csv = execFileSync(
    "docker",
    [
      "exec",
      DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-t",
      "-A",
      "-F",
      "|",
      "-c",
      `select p.id, p.email, p.company_id, p.location_id, c.provider_id,
              coalesce(c.billing_country, 'NO'),
              coalesce(c.contact_email, ''),
              (substring(p.email from 'p18scale-emp-([0-9]+)@'))::int as emp_index
       from profiles p
       join companies c on c.id = p.company_id
       where p.email like 'p18scale-emp-%@load.lunchportalen.test'
       order by emp_index`,
    ],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );

  const manifestPath = path.join(OUT, "employee-manifest.ndjson");
  const ws = fs.createWriteStream(manifestPath);
  let n = 0;
  const countries = new Set();
  const locales = new Set();
  const packages = new Set();
  for (const line of csv.split("\n")) {
    if (!line.trim()) continue;
    const [user_id, email, company_id, location_id, provider_id, country, contactEmail, idxStr] = line.split("|");
    const index = Number(idxStr);
    const locale = localeForEmployeeIndex(index);
    let pkg = "BASIS";
    if (/co-luxus/i.test(contactEmail)) pkg = "LUXUS";
    else if (/co-enterprise/i.test(contactEmail)) pkg = "ENTERPRISE";
    countries.add(country);
    locales.add(locale);
    packages.add(pkg);
    ws.write(
      `${JSON.stringify({
        user_id,
        email,
        company_id,
        location_id,
        provider_id,
        country,
        package: pkg,
        locale,
        index,
      })}\n`,
    );
    n += 1;
  }
  ws.end();
  const report = {
    phase: "18SCALE",
    TOTAL_EMPLOYEE_PROFILES: n,
    countries: countries.size,
    locales: locales.size,
    packages: [...packages],
    path: "employee-manifest.ndjson",
    stamped_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, "export-employee-manifest.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (n < 100000) process.exit(2);
}

main();
