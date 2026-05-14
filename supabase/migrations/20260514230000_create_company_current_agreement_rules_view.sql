-- public.company_current_agreement_rules
-- Read-only view for lib/agreement/requireRule.ts (POST /api/orders preflight).
--
-- One row per (company_id, day_key, lunch) for the *current* ACTIVE agreement per company:
-- same DISTINCT ON (company_id) … ORDER BY created_at DESC as company_current_agreement.
--
-- Per-day tier: public.agreement_delivery_days.weekday when joined; else agreements.tier.
-- Prices (ex VAT): BASIS → price_per_meal_nok, LUXUS → price_per_meal_luxus_nok,
-- ENTERPRISE → COALESCE(price_per_meal_enterprise_nok, price_per_meal_nok).
-- price_inc_vat: round(ex * 1.15)::integer (Norwegian food VAT — næringsmidler/catering).
--
-- valid_from / valid_to: COALESCE(starts_at, start_date, 1970-01-01) and ends_at so
-- requireRule date filters (lte valid_from, valid_to null or gte) never drop rows for
-- lack of starts_at when start_date is set.
--
-- Deterministic id: uuid_generate_v5 (namespace fixed for this view; requires uuid-ossp).

create or replace view public.company_current_agreement_rules as
with
current_agreement as (
  select distinct on (a.company_id)
    a.*
  from public.agreements a
  where a.status = 'ACTIVE'::public.agreement_status
  order by a.company_id, a.created_at desc
),
expanded as (
  select
    ca.company_id,
    ca.id as agreement_id,
    lower(trim(d.value)) as day_key,
    coalesce(add.tier, ca.tier) as day_tier,
    ca.price_per_meal_nok,
    ca.price_per_meal_luxus_nok,
    ca.price_per_meal_enterprise_nok,
    ca.starts_at,
    ca.start_date,
    ca.ends_at
  from current_agreement ca
  cross join lateral jsonb_array_elements_text(ca.delivery_days) as d(value)
  left join public.agreement_delivery_days add
    on add.agreement_id = ca.id
    and add.weekday = lower(trim(d.value))
  where lower(trim(d.value)) in ('mon', 'tue', 'wed', 'thu', 'fri')
),
priced as (
  select
    e.*,
    case e.day_tier
      when 'BASIS'::public.agreement_tier then e.price_per_meal_nok::numeric
      when 'LUXUS'::public.agreement_tier then e.price_per_meal_luxus_nok::numeric
      when 'ENTERPRISE'::public.agreement_tier then coalesce(
        e.price_per_meal_enterprise_nok,
        e.price_per_meal_nok
      )::numeric
    end as price_ex_vat
  from expanded e
)
select
  uuid_generate_v5(
    'a04f0000-0000-0000-0000-000000000001'::uuid,
    p.company_id::text || '|' || p.day_key || '|lunch'
  ) as id,
  p.company_id,
  p.day_key::text as day_key,
  'lunch'::text as slot,
  true as is_enabled,
  p.day_tier as tier,
  p.price_ex_vat,
  case
    when p.price_ex_vat is null then null
    else round(p.price_ex_vat * 1.15)::integer
  end as price_inc_vat,
  coalesce(p.starts_at, p.start_date, date '1970-01-01') as valid_from,
  p.ends_at as valid_to
from priced p;

grant select on public.company_current_agreement_rules to authenticated;
grant select on public.company_current_agreement_rules to service_role;
