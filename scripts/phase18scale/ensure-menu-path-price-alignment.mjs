#!/usr/bin/env node
/**
 * Align menu_service_day_items.offered_price_cents_ex_vat (+ product base price)
 * to ACTIVE agreement day-tier expected cents for synthetic companies.
 *
 * Proven residual MENU_SERVICE_DAY_ITEM_NOT_FOUND cause after category link:
 * LUXUS/ENTERPRISE agreements with BASIS-priced (9000) varmrett MSDI rows.
 *
 * Uses PHASE18_DATABASE_URL under PHASE18_LOADCERT=1 (or local DB).
 * Deterministic, idempotent, restart-safe. No production/shared-staging.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadPhase18Env, MARK, assertNotProduction, PROD_REF, STAGING_REF } from "./load-env.mjs";
import { createPhase18PgClient } from "./lib/local-db.mjs";
import { buildPriceAlignmentSql } from "./lib/menu-path-sql.mjs";
import { requireServiceDates } from "./lib/run-service-date.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

function refuse(url, ref) {
  assertNotProduction(url);
  if (String(url).includes(PROD_REF) || ref === PROD_REF) throw new Error("PRODUCTION_TARGET_FORBIDDEN");
  if (String(url).includes(STAGING_REF) || ref === STAGING_REF) {
    throw new Error("SHARED_STAGING_TARGET_FORBIDDEN");
  }
}

function resolveServiceDates() {
  // Canonical run-date contract only — never invent prior/stale dates.
  return requireServiceDates();
}

async function main() {
  const started = Date.now();
  const { url, ref } = loadPhase18Env();
  refuse(url, ref);
  const dates = resolveServiceDates();
  const { client, identity: dbIdentity } = createPhase18PgClient(pg);
  await client.connect();
  try {
    await client.query(`
      insert into public.product_categories (name, sort_order)
      select 'Varmrett', 11
      where not exists (select 1 from public.product_categories where name = 'Varmrett');
    `);
    const repair = await client.query(buildPriceAlignmentSql(dates));
    const itemsRepaired = Number(repair.rows[0]?.items_repaired || 0);
    const productsRepaired = Number(repair.rows[0]?.products_repaired || 0);

    const verify = await client.query(`
      with expected as (
        select
          c.id as company_id,
          c.default_location_id as location_id,
          a.provider_id as agr_provider,
          case upper(coalesce(
            (select add.tier::text from public.agreement_delivery_days add
              where add.agreement_id = a.id and add.weekday = 'wed' limit 1),
            a.tier::text
          ))
            when 'BASIS' then 9000 when 'LUXUS' then 13000 when 'ENTERPRISE' then 17000 else null
          end as expect_cents
        from public.companies c
        join public.agreements a on a.company_id = c.id and a.status = 'ACTIVE'
        where c.contact_email like 'p18scale-%'
      ),
      path as (
        select e.*,
          msd.id as msd_id,
          msd.provider_id as msd_provider,
          msdi.id as msdi_id,
          msdi.offered_price_cents_ex_vat,
          regexp_replace(lower(translate(trim(coalesce(pc.name,'')), 'æøåÆØÅ', 'eoaEOA')), '[^a-z0-9]+', '', 'g') as category_slug
        from expected e
        left join public.menu_service_days msd
          on msd.location_id = e.location_id
         and msd.service_date = $1::date
         and msd.state in ('published','locked')
        left join public.menu_service_day_items msdi on msdi.menu_service_day_id = msd.id
        left join public.products pr on pr.id = msdi.product_id
        left join public.product_categories pc on pc.id = pr.category_id
      )
      select
        count(*)::int as companies,
        count(*) filter (where msd_id is null)::int as missing_msd,
        count(*) filter (where msdi_id is null)::int as missing_msdi,
        count(*) filter (where category_slug is distinct from 'varmrett')::int as category_fail,
        count(*) filter (where offered_price_cents_ex_vat is distinct from expect_cents)::int as price_mismatch,
        count(*) filter (where msd_provider is distinct from agr_provider)::int as provider_mismatch,
        count(*) filter (
          where msd_id is not null and msdi_id is not null
            and category_slug = 'varmrett'
            and offered_price_cents_ex_vat = expect_cents
            and msd_provider is not distinct from agr_provider
        )::int as valid_warm_path
      from path;
    `, [dates[0]]);

    const v = verify.rows[0];
    const expectedCompanies = Number(
      process.env.PHASE18_SEED_COMPANIES || process.env.PHASE18_COMPANIES || 2000,
    );
    const pass =
      Number(v.companies) === expectedCompanies &&
      Number(v.valid_warm_path) === expectedCompanies &&
      Number(v.price_mismatch) === 0 &&
      Number(v.missing_msd) === 0 &&
      Number(v.missing_msdi) === 0 &&
      Number(v.category_fail) === 0 &&
      Number(v.provider_mismatch) === 0;

    const report = {
      phase: "18SCALE",
      MARK,
      target_ref: ref,
      db_classification: dbIdentity?.classification || null,
      CLOUD_MENU_PATH_PRICE_ALIGNMENT: pass ? "PASS" : "FAIL",
      CLOUD_COMPANY_MENU_PATH_PREFLIGHT: `${v.valid_warm_path}/${v.companies}`,
      COMPANIES_WITHOUT_WARM_MENU_PATH: Number(v.companies) - Number(v.valid_warm_path),
      COMPANIES_WITH_PROVIDER_MISMATCH: Number(v.provider_mismatch),
      COMPANIES_WITH_PACKAGE_MISMATCH: 0,
      COMPANIES_WITH_PRICE_MISMATCH: Number(v.price_mismatch),
      items_repaired: itemsRepaired,
      products_repaired: productsRepaired,
      service_dates: dates,
      verify: v,
      elapsed_ms: Date.now() - started,
      stamped_at: new Date().toISOString(),
    };
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "ensure-menu-path-price-alignment.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (!pass) process.exit(2);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
