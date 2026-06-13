/**
 * Prod-realistic MSDI seed for variant item_key integration (uigx only).
 * BASIS dag: kun paasmurt/salatboks/varmrett @9000 (ingen sushi/pokebowl/thaimat).
 * LUXUS dag: alle plan-kategorier @13000, kategori-navn «Thaimat» (som prod sync).
 */
import { SMOKE_BASIS_PRICE_CENTS, SMOKE_COMPANY_ID, SMOKE_LOCATION_ID } from "../../scripts/smoke/fixtures/smoke-menu-fixture.constants.mjs";

/** Wed / Thu in smoke agreement (BASIS / LUXUS); fresh dates avoid locked-order msdi churn. */
export const VARIANT_TEST_BASIS_DATE = "2026-06-10";
export const VARIANT_TEST_LUXUS_DATE = "2026-06-11";
export const VARIANT_TEST_LUXUS_PRICE_CENTS = 13000;

/** Choice keys → product SKU (global catalog on uigx). */
export const VARIANT_TEST_PRODUCT_SKUS = {
  paasmurt: "paasmurt",
  salatboks: "salatboks",
  varmrett: "varmrett",
  sushi: "sushi",
  pokebowl: "pokebowl",
  thaimat: "thaimat",
};

const BASIS_SKUS = ["paasmurt", "salatboks", "varmrett"];
const LUXUS_SKUS = ["paasmurt", "salatboks", "varmrett", "sushi", "pokebowl", "thaimat"];

function sqlList(skus) {
  return skus.map((s) => `'${s}'`).join(", ");
}

function buildCategoriesSql() {
  return `
update public.product_categories set name = 'Thaimat', updated_at = now()
where lower(trim(name)) in ('thai', 'thaimat');

insert into public.product_categories (name, sort_order, created_at, updated_at)
select v.name, v.sort_order, now(), now()
from (values
  ('Paasmurt', 1),
  ('Salatboks', 2),
  ('Varmrett', 3),
  ('Sushi', 4),
  ('Pokebowl', 5),
  ('Thaimat', 6)
) as v(name, sort_order)
where not exists (select 1 from public.product_categories pc where pc.name = v.name);

update public.products p
set category_id = (select id from public.product_categories where name = 'Thaimat' limit 1),
    updated_at = now()
where p.company_id is null and p.sku = 'thai';

update public.products p
set sku = 'thaimat', updated_at = now()
where p.company_id is null and p.sku = 'thai'
  and not exists (select 1 from public.products x where x.company_id is null and x.sku = 'thaimat');
`;
}

function buildPreSeedOrderCleanupSql(dates) {
  const dateList = dates.map((d) => `'${d}'::date`).join(", ");
  return `
delete from public.order_items oi
using public.orders o
where oi.order_id = o.id
  and o.company_id = '${SMOKE_COMPANY_ID}'
  and o.location_id = '${SMOKE_LOCATION_ID}'
  and o.date in (${dateList});

delete from public.orders o
where o.company_id = '${SMOKE_COMPANY_ID}'
  and o.location_id = '${SMOKE_LOCATION_ID}'
  and o.date in (${dateList});

delete from public.day_choices dc
where dc.company_id = '${SMOKE_COMPANY_ID}'
  and dc.location_id = '${SMOKE_LOCATION_ID}'
  and dc.date in (${dateList});
`;
}

function buildDayMsdSql(serviceDate, priceCents, skus) {
  const skuList = sqlList(skus);
  return `
insert into public.menu_service_days (company_id, location_id, service_date, state, provider_id, created_at, updated_at)
select '${SMOKE_COMPANY_ID}', '${SMOKE_LOCATION_ID}', '${serviceDate}'::date, 'published', c.provider_id, now(), now()
from public.companies c where c.id = '${SMOKE_COMPANY_ID}'
on conflict (location_id, service_date) do update set state = 'published', updated_at = now();

delete from public.menu_service_day_items msdi
using public.menu_service_days msd
where msdi.menu_service_day_id = msd.id
  and msd.location_id = '${SMOKE_LOCATION_ID}'
  and msd.service_date = '${serviceDate}'::date;

insert into public.menu_service_day_items (menu_service_day_id, product_id, product_name_snapshot, unit_name_snapshot, offered_price_cents_ex_vat, vat_rate_snapshot, quantity, sort_order, is_optional, created_at, updated_at)
select msd.id, p.id, p.name, 'porsjon', ${priceCents}, 0.15, 1,
  10 + row_number() over (order by p.sku), false, now(), now()
from public.menu_service_days msd
inner join public.products p on p.company_id is null and p.sku in (${skuList})
where msd.location_id = '${SMOKE_LOCATION_ID}'
  and msd.service_date = '${serviceDate}'::date
  and msd.state in ('published', 'locked');
`;
}

/** Full prod-realistic seed for variant item_key tests on uigx. */
export function buildProdRealisticVariantSeedSql() {
  const dates = [VARIANT_TEST_BASIS_DATE, VARIANT_TEST_LUXUS_DATE];
  return [
    buildPreSeedOrderCleanupSql(dates),
    buildCategoriesSql(),
    buildDayMsdSql(VARIANT_TEST_BASIS_DATE, SMOKE_BASIS_PRICE_CENTS, BASIS_SKUS),
    buildDayMsdSql(VARIANT_TEST_LUXUS_DATE, VARIANT_TEST_LUXUS_PRICE_CENTS, LUXUS_SKUS),
  ].join("\n");
}
