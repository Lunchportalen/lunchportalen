create or replace view public.company_current_agreement as
select distinct on (a.company_id)
  a.id,
  a.company_id,
  a.id as agreement_id,
  a.location_id,
  a.status,
  a.tier as plan_tier,
  a.price_per_meal_nok as price_per_cuvert_nok,
  a.delivery_days,
  a.starts_at as start_date,
  a.ends_at as end_date,
  a.created_at,
  a.updated_at
from public.agreements a
where a.status = 'ACTIVE'
order by a.company_id, a.created_at desc;

grant select on public.company_current_agreement to authenticated;
grant select on public.company_current_agreement to service_role;
