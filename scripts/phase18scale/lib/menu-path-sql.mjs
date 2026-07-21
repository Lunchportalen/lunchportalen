/**
 * Shared SQL fragments for menu-path price alignment (lp_order_set varmmat path).
 */
export const PRICE_BY_TIER = { BASIS: 9000, LUXUS: 13000, ENTERPRISE: 17000 };

/** Bulk repair offered prices + product base prices for synthetic companies. */
export function buildPriceAlignmentSql(serviceDates = ["2026-07-21", "2026-07-22"]) {
  const dates = serviceDates.map((d) => `'${d}'`).join(", ");
  return `
with expect as (
  select
    c.id as company_id,
    c.default_location_id as location_id,
    a.id as agreement_id,
    case upper(coalesce(
      (select add.tier::text from public.agreement_delivery_days add
        where add.agreement_id = a.id and add.weekday = 'wed' limit 1),
      a.tier::text
    ))
      when 'BASIS' then 9000
      when 'LUXUS' then 13000
      when 'ENTERPRISE' then 17000
      else null
    end as expect_cents
  from public.companies c
  join public.agreements a on a.company_id = c.id and a.status = 'ACTIVE'
  where c.contact_email like 'p18scale-%'
),
upd_items as (
  update public.menu_service_day_items msdi
  set offered_price_cents_ex_vat = e.expect_cents,
      updated_at = now()
  from public.menu_service_days msd
  join expect e on e.location_id = msd.location_id
  where msdi.menu_service_day_id = msd.id
    and msd.service_date in (${dates})
    and msd.state in ('published', 'locked')
    and e.expect_cents is not null
    and msdi.offered_price_cents_ex_vat is distinct from e.expect_cents
  returning msdi.id
),
upd_products as (
  update public.products pr
  set base_price_cents_ex_vat = e.expect_cents,
      category_id = coalesce(
        pr.category_id,
        (select id from public.product_categories where name = 'Varmrett' limit 1)
      ),
      updated_at = now()
  from expect e
  where pr.company_id = e.company_id
    and pr.sku = 'varmrett'
    and e.expect_cents is not null
    and (
      pr.base_price_cents_ex_vat is distinct from e.expect_cents
      or pr.category_id is null
    )
  returning pr.id
)
select
  (select count(*)::int from upd_items) as items_repaired,
  (select count(*)::int from upd_products) as products_repaired;
`;
}
