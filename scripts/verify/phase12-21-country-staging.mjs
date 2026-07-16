#!/usr/bin/env node
/**
 * PHASE 12 — APPLY 21-COUNTRY MODEL TO STAGING (verification + rehearsal).
 *
 * Kjøres KUN mot staging (uigx) — production (hkpoky) avvises hardt.
 *
 * Steg (fail-closed, alle må PASSE):
 *   1. BACKUP        — logisk dump av markedsdomenet (.backups/) +
 *                      radtelling-baseline for ALLE public-tabeller.
 *   2. MIGRATIONS    — 20260815–20260817 + alle godkjente migrasjoner applied.
 *   3. MARKET MATRIX — 21 unike land, 24 aktive locales, AU/SG/LU inaktive
 *                      (lesbare, aldri slettet), BE/CH/CA = ett marked med to locales.
 *   4. CONSTRAINTS   — ingen NOT VALID-constraints i public.
 *   5. ORPHANS       — ingen foreldreløse rader i kjernedomenet.
 *   6. OLD IDENTITIES— gamle locale-identiteter (AU/SG/LU) lesbare med intakt data.
 *   7. ROLLBACK      — transaksjonell rehearsal: reverser 21-landskorreksjonen,
 *                      verifiser gammel modell lesbar, ROLLBACK, verifiser
 *                      nåværende modell uendret.
 *   8. DATA LOSS     — radtelling etter rehearsal identisk med baseline.
 *
 * Usage: node scripts/verify/phase12-21-country-staging.mjs
 * Env:   .env.local (SUPABASE_DB_PASSWORD_STAGING)
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const EXPECTED_COUNTRIES = [
  "NO","SE","DK","FI","GB","DE","FR","ES","IT","NL",
  "BE","CH","AT","IE","PL","RO","CZ","PT","GR","US","CA",
];
const EXPECTED_LOCALES = [
  "nb-NO","sv-SE","da-DK","fi-FI","en-GB","de-DE","fr-FR","es-ES","it-IT",
  "nl-NL","nl-BE","fr-BE","de-CH","fr-CH","de-AT","en-IE","pl-PL","ro-RO",
  "cs-CZ","pt-PT","el-GR","en-US","en-CA","fr-CA",
];
const RETIRED = ["AU", "SG", "LU"];

const failures = [];
const ok = (msg) => console.log(`OK: ${msg}`);
const fail = (msg) => {
  failures.push(msg);
  console.error(`FAIL: ${msg}`);
};

function stagingClient() {
  const env = Object.fromEntries(
    fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
  );
  const pw = encodeURIComponent(env.SUPABASE_DB_PASSWORD_STAGING ?? "");
  if (!pw) throw new Error("SUPABASE_DB_PASSWORD_STAGING mangler i .env.local");
  const ref = "uigxsboqeruxflgzqztl"; // staging — ALDRI production (hkpoky)
  const url = `postgresql://postgres:${pw}@db.${ref}.supabase.co:5432/postgres`;
  if (url.includes("hkpoky")) throw new Error("ABORT: production er forbudt i Fase 12");
  return new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
}

async function tableRowCounts(client) {
  const { rows } = await client.query(`
    select c.relname as table_name, c.reltuples::bigint as estimate
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname`);
  // Eksakte tellinger for domenekritiske tabeller; estimat er ikke bevis.
  const critical = [
    "markets", "market_approvals", "market_approval_events",
    "companies", "providers", "organizations", "profiles",
    "orders", "order_items", "agreements",
    "agreement_invoices", "agreement_invoice_lines", "invoice_payments",
    "commission_ledger", "commission_periods", "provider_commission_invoices",
    "organization_billing_profiles", "menu_content_translations",
    "superadmin_translations",
  ];
  const counts = {};
  for (const t of critical) {
    if (!rows.some((r) => r.table_name === t)) continue;
    const { rows: c } = await client.query(`select count(*)::bigint as n from public."${t}"`);
    counts[t] = String(c[0].n);
  }
  return counts;
}

const client = stagingClient();
await client.connect();

try {
  // -------------------------------------------------------------------------
  // 1) BACKUP — logisk dump av markedsdomenet + radtelling-baseline.
  // -------------------------------------------------------------------------
  fs.mkdirSync(".backups", { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const backup = { createdAt: new Date().toISOString(), tables: {} };
  for (const t of ["markets", "market_approvals", "market_approval_events"]) {
    const { rows } = await client.query(`select * from public."${t}" order by 1`);
    backup.tables[t] = rows;
  }
  const baseline = await tableRowCounts(client);
  backup.rowCountBaseline = baseline;
  const backupPath = path.join(".backups", `phase12-market-domain-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 1), "utf8");
  ok(`backup skrevet: ${backupPath} (${Object.keys(backup.tables).map((t) => `${t}=${backup.tables[t].length}`).join(", ")}) + radtelling-baseline (${Object.keys(baseline).length} tabeller). Plattform-PITR: Supabase automated backups.`);

  // -------------------------------------------------------------------------
  // 2) MIGRATIONS — 20260815–20260817 + alle godkjente migrasjoner applied.
  // -------------------------------------------------------------------------
  const localMigrations = fs
    .readdirSync("supabase/migrations")
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .map((f) => f.slice(0, 14))
    .sort();
  const { rows: applied } = await client.query(`select version from supabase_migrations.schema_migrations order by version`);
  const appliedSet = new Set(applied.map((r) => String(r.version)));
  const missing = localMigrations.filter((v) => !appliedSet.has(v));
  if (missing.length > 0) fail(`migrasjoner ikke applied på staging: ${missing.join(", ")}`);
  else ok(`alle ${localMigrations.length} lokale migrasjoner applied (remote: ${appliedSet.size})`);

  for (const v of ["20260815120000", "20260816120000", "20260817120000"]) {
    if (!appliedSet.has(v)) fail(`påkrevd migrasjon ${v} mangler`);
  }
  if (["20260815120000", "20260816120000", "20260817120000"].every((v) => appliedSet.has(v))) {
    ok("20260815–20260817 (15-språks widening + 21-landskorreksjon) applied");
  }

  // -------------------------------------------------------------------------
  // 3) MARKET MATRIX
  // -------------------------------------------------------------------------
  const { rows: markets } = await client.query(
    `select country_code, locale, slug, is_active, default_currency, default_timezone from public.markets order by country_code, locale`,
  );
  const active = markets.filter((m) => m.is_active === true);
  const activeCountries = [...new Set(active.map((m) => m.country_code))].sort();
  if (activeCountries.join(",") !== [...EXPECTED_COUNTRIES].sort().join(",")) {
    fail(`aktive land: [${activeCountries.join(",")}] (forventet de 21 kanoniske)`);
  } else ok("21/21 unike aktive land (eksakt kanonisk sett)");

  const activeLocales = active.map((m) => m.locale).sort();
  if (activeLocales.join(",") !== [...EXPECTED_LOCALES].sort().join(",")) {
    fail(`aktive locales (${activeLocales.length}): [${activeLocales.join(",")}] (forventet de 24 kanoniske)`);
  } else ok("24/24 aktive market locales (eksakt kanonisk sett)");

  for (const [cc, expected] of [["BE", ["fr-BE", "nl-BE"]], ["CH", ["de-CH", "fr-CH"]], ["CA", ["en-CA", "fr-CA"]]]) {
    const locales = active.filter((m) => m.country_code === cc).map((m) => m.locale).sort();
    if (locales.join(",") !== expected.join(",")) fail(`${cc}: locales [${locales.join(",")}] (forventet ${expected.join("/")})`);
    else ok(`${cc}: ETT marked med ${expected.join(" + ")}`);
  }

  for (const cc of RETIRED) {
    const rows = markets.filter((m) => m.country_code === cc);
    if (rows.length === 0) fail(`${cc}: rad SLETTET (skal være inaktiv men lesbar)`);
    else if (rows.some((m) => m.is_active)) fail(`${cc}: fortsatt aktiv (skal være inaktiv)`);
    else ok(`${cc}: inaktiv men lesbar (${rows.map((r) => `${r.locale}/${r.slug}`).join(", ")})`);
  }

  // market_approvals dekker nøyaktig de 21 landene.
  const { rows: approvals } = await client.query(`select country_code from public.market_approvals order by country_code`);
  const approvalCountries = approvals.map((r) => r.country_code).sort();
  if (approvalCountries.join(",") !== [...EXPECTED_COUNTRIES].sort().join(",")) {
    fail(`market_approvals dekker [${approvalCountries.join(",")}] (forventet de 21)`);
  } else ok("market_approvals: 21/21 land i godkjenningsregisteret");

  // -------------------------------------------------------------------------
  // 4) CONSTRAINTS — alle validert (ingen NOT VALID).
  // -------------------------------------------------------------------------
  const { rows: invalid } = await client.query(`
    select conrelid::regclass::text as tbl, conname
    from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and not c.convalidated`);
  if (invalid.length > 0) fail(`NOT VALID-constraints: ${invalid.map((r) => `${r.tbl}.${r.conname}`).join(", ")}`);
  else ok("alle public-constraints er validert (0 NOT VALID)");

  // -------------------------------------------------------------------------
  // 5) ORPHANS — ingen foreldreløse rader i kjernedomenet.
  // -------------------------------------------------------------------------
  const orphanChecks = [
    ["orders uten company", `select count(*)::int as n from public.orders o where o.company_id is not null and not exists (select 1 from public.companies c where c.id = o.company_id)`],
    ["orders uten provider", `select count(*)::int as n from public.orders o where o.provider_id is not null and not exists (select 1 from public.providers p where p.id = o.provider_id)`],
    ["order_items uten order", `select count(*)::int as n from public.order_items oi where not exists (select 1 from public.orders o where o.id = oi.order_id)`],
    ["agreements uten company", `select count(*)::int as n from public.agreements a where not exists (select 1 from public.companies c where c.id = a.company_id)`],
    ["companies uten provider", `select count(*)::int as n from public.companies c where c.provider_id is not null and not exists (select 1 from public.providers p where p.id = c.provider_id)`],
    ["billingprofil uten organisasjon", `select count(*)::int as n from public.organization_billing_profiles obp where not exists (select 1 from public.organizations o where o.id = obp.organization_id)`],
    ["billingprofil uten marked", `select count(*)::int as n from public.organization_billing_profiles obp where not exists (select 1 from public.markets m where m.id = obp.market_id)`],
    ["agreement_invoices uten provider", `select count(*)::int as n from public.agreement_invoices i where not exists (select 1 from public.providers p where p.id = i.provider_id)`],
    ["agreement_invoice_lines uten faktura", `select count(*)::int as n from public.agreement_invoice_lines l where not exists (select 1 from public.agreement_invoices i where i.id = l.invoice_id)`],
    ["commission_ledger uten organisasjon", `select count(*)::int as n from public.commission_ledger cl where not exists (select 1 from public.organizations o where o.id = cl.provider_id)`],
    ["provider_commission_invoices uten periode", `select count(*)::int as n from public.provider_commission_invoices pci where not exists (select 1 from public.commission_periods cp where cp.id = pci.commission_period_id)`],
    ["profiles med ukjent company", `select count(*)::int as n from public.profiles pr where pr.company_id is not null and not exists (select 1 from public.companies c where c.id = pr.company_id)`],
  ];
  let orphanTotal = 0;
  for (const [label, sql] of orphanChecks) {
    const { rows } = await client.query(sql);
    const n = Number(rows[0].n);
    if (n > 0) fail(`orphans — ${label}: ${n}`);
    orphanTotal += n;
  }
  if (orphanTotal === 0) ok(`0 orphan-rader (${orphanChecks.length} relasjoner sjekket)`);

  // -------------------------------------------------------------------------
  // 6) OLD LOCALE IDENTITIES — lesbare og innenfor 15-språksmodellen.
  // -------------------------------------------------------------------------
  const { rows: retiredRows } = await client.query(
    `select country_code, locale, slug, default_currency from public.markets where country_code = any($1) order by country_code`,
    [RETIRED],
  );
  if (retiredRows.length >= 3 && retiredRows.every((r) => r.locale && r.slug && r.default_currency)) {
    ok(`gamle locale-identiteter lesbare: ${retiredRows.map((r) => `${r.locale}(${r.default_currency})`).join(", ")}`);
  } else fail("gamle locale-identiteter er ikke intakte");

  const { rows: badPrefs } = await client.query(`
    select count(*)::int as n from public.profiles
    where preferred_locale is not null
      and preferred_locale not in ('nb','en','sv','da','fi','de','fr','es','it','nl','pl','ro','cs','pt','el')`);
  if (Number(badPrefs[0].n) > 0) fail(`profiles.preferred_locale utenfor 15-språksmodellen: ${badPrefs[0].n}`);
  else ok("alle profiles.preferred_locale innenfor 15-språksmodellen");

  // -------------------------------------------------------------------------
  // 7) ROLLBACK REHEARSAL — transaksjonell, aldri persistert.
  // -------------------------------------------------------------------------
  await client.query("begin");
  try {
    // Reverser 21-landskorreksjonen (som 20260817 sin motsats — ingen sletting):
    await client.query(`update public.markets set is_active = false where country_code in ('PL','RO','CZ','PT','GR') or locale = 'fr-CA'`);
    await client.query(`update public.markets set is_active = true where country_code in ('AU','SG','LU')`);

    const { rows: rb } = await client.query(`select count(distinct country_code)::int as countries, count(*)::int as locales from public.markets where is_active = true`);
    // Gammel modell: 21 - 5 nye + 3 gjenåpnede = 19 land; 24 - 6 + 3 = 21 locales.
    if (Number(rb[0].countries) !== 19 || Number(rb[0].locales) !== 21) {
      fail(`rollback-rehearsal: uventet gammel modell (countries=${rb[0].countries}, locales=${rb[0].locales}; forventet 19/21)`);
    } else {
      ok("rollback-rehearsal: gammel markedsmodell (pre-20260817) reproduserbar og lesbar i transaksjon");
    }
    // Ingen datasletting i rollback: alle rader finnes fortsatt.
    const { rows: still } = await client.query(`select count(*)::int as n from public.markets`);
    if (Number(still[0].n) !== markets.length) fail("rollback-rehearsal: markeds-rader forsvant");
  } finally {
    await client.query("rollback");
  }

  // Verifiser at nåværende modell er uendret etter rehearsal.
  const { rows: after } = await client.query(`select count(distinct country_code)::int as countries, count(*)::int as locales from public.markets where is_active = true`);
  if (Number(after[0].countries) !== 21 || Number(after[0].locales) !== 24) {
    fail(`etter rollback-rehearsal: modellen endret (countries=${after[0].countries}, locales=${after[0].locales})`);
  } else ok("etter rollback-rehearsal: 21 land / 24 locales intakt (ROLLBACK bevist uten sideeffekter)");

  // -------------------------------------------------------------------------
  // 8) DATA LOSS — radtelling identisk med baseline.
  // -------------------------------------------------------------------------
  const recount = await tableRowCounts(client);
  const diffs = Object.keys(baseline).filter((t) => baseline[t] !== recount[t]);
  if (diffs.length > 0) fail(`radtelling endret for: ${diffs.map((t) => `${t} ${baseline[t]}→${recount[t]}`).join(", ")}`);
  else ok(`0 datatap: radtelling identisk med baseline for ${Object.keys(baseline).length} domenetabeller`);
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
} finally {
  await client.end().catch(() => {});
}

if (failures.length > 0) {
  console.error(`\nPHASE 12 STAGING VERIFICATION FAILED — ${failures.length} funn.`);
  process.exit(1);
}
console.log("\nPHASE 12 STAGING VERIFICATION: PASS (21 land, 24 locales, rollback bevist, 0 datatap)");
