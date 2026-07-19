#!/usr/bin/env node
/**
 * PHASE 18SCALE — Deterministic profile→company/location backfill (local/isolated).
 * Assigns p18scale-emp-NNNNNN to companies by index using the same matrix layout as seed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { loadPhase18Env, assertNotProduction } from "./load-env.mjs";
import { COMPANY_COUNT, EMPLOYEE_COUNT } from "./lib/matrix.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const DB_CONTAINER = process.env.PHASE18_DB_CONTAINER || "supabase_db_lunchportalen";

function envInt(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v != null && String(v).trim() !== "") return Number(v);
  }
  return NaN;
}

function psql(sql) {
  return execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  ).trim();
}

function main() {
  const { url } = loadPhase18Env();
  assertNotProduction(url);
  if (!/127\.0\.0\.1|localhost|kong/i.test(url)) {
    throw new Error("PROFILE_BACKFILL_LOCAL_ONLY");
  }

  const companies = envInt("PHASE18_COMPANIES", "PHASE18_SEED_COMPANIES") || COMPANY_COUNT;
  const employees = envInt("PHASE18_EMPLOYEES", "PHASE18_SEED_EMPLOYEES") || EMPLOYEE_COUNT;
  const empPerCompany = Math.max(1, Math.ceil(employees / companies));

  const sql = `
BEGIN;
WITH ranked_companies AS (
  SELECT c.id AS company_id, c.default_location_id AS location_id,
         row_number() OVER (ORDER BY c.contact_email) - 1 AS company_index
  FROM public.companies c
  WHERE c.contact_email LIKE 'p18scale-%'
),
emp AS (
  SELECT p.id AS profile_id, p.email,
         (substring(p.email from 'p18scale-emp-([0-9]+)@'))::int AS emp_index
  FROM public.profiles p
  WHERE p.email LIKE 'p18scale-emp-%@load.lunchportalen.test'
),
mapped AS (
  SELECT e.profile_id, e.emp_index, e.email,
         (e.emp_index / ${empPerCompany})::int AS company_index
  FROM emp e
  WHERE e.emp_index >= 0 AND e.emp_index < ${employees}
)
UPDATE public.profiles p
SET
  company_id = rc.company_id,
  location_id = rc.location_id,
  role = 'employee',
  full_name = 'P18 Emp ' || m.emp_index::text,
  active = true,
  is_active = true,
  preferred_locale = (ARRAY[
    'nb','sv','da','fi','en','de','fr','es','it','nl',
    'nl','fr','de','fr','de','en','pl','ro','cs','pt',
    'el','en','en','fr'
  ])[(m.emp_index % 24) + 1]
FROM mapped m
JOIN ranked_companies rc ON rc.company_index = m.company_index
WHERE p.id = m.profile_id;
COMMIT;
`;

  execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
    { input: sql, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );

  const withCompany = Number(psql(`select count(*) from profiles where email like 'p18scale-emp-%' and company_id is not null`) || "0");
  const nullCompany = Number(psql(`select count(*) from profiles where email like 'p18scale-emp-%' and company_id is null`) || "0");
  const distinctCo = Number(psql(`select count(distinct company_id) from profiles where email like 'p18scale-emp-%' and company_id is not null`) || "0");
  const report = {
    phase: "18SCALE",
    companies,
    employees,
    empPerCompany,
    PROFILES_WITH_COMPANY: withCompany,
    PROFILES_NULL_COMPANY: nullCompany,
    DISTINCT_COMPANIES_ON_PROFILES: distinctCo,
    pass: nullCompany === 0 && withCompany >= employees && distinctCo === companies,
    stamped_at: new Date().toISOString(),
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "backfill-employee-profiles.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(2);
}

main();
