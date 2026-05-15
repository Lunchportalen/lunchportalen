-- FASE 13-IMPL-1: Consolidate all FKs and DB logic from obsolete public.locations
-- onto public.company_locations as single source of truth, then drop public.locations.
--
-- Preconditions verified (staging/live SQL, 2026-05-15):
-- - 8 FKs reference public.locations
-- - public.locations has 0 rows; public.company_locations is operative
-- - 0 orphaned location_id FK values vs company_locations across those tables
--
-- Note: compute_cutoff_at previously read locations.timezone; company_locations has no
-- timezone column. Resolution: join public.companies and use coalesce(companies.timezone, 'Europe/Oslo').
--
-- ON DELETE: all recreated FKs use ON DELETE RESTRICT per product decision (see IMP ticket).

begin;

--------------------------------------------------------------------------------
-- 1) Drop FKs pointing at public.locations (must occur before function bodies
--    stop referencing that table; locations is empty but triggers would still fail)
--------------------------------------------------------------------------------

alter table public.billing_adjustments
  drop constraint if exists billing_adjustments_location_id_fkey;

alter table public.company_memberships
  drop constraint if exists company_memberships_location_id_fkey;

alter table public.delivery_runs
  drop constraint if exists delivery_runs_location_id_fkey;

alter table public.location_closed_dates
  drop constraint if exists location_closed_dates_location_id_fkey;

alter table public.location_policies
  drop constraint if exists location_policies_location_id_fkey;

alter table public.menu_service_days
  drop constraint if exists menu_service_days_location_id_fkey;

alter table public.orders
  drop constraint if exists orders_location_id_fkey;

alter table public.standing_orders
  drop constraint if exists standing_orders_location_id_fkey;

--------------------------------------------------------------------------------
-- 2) FUNCTIONS (replace public.locations with public.company_locations)
--------------------------------------------------------------------------------

create or replace function public.compute_cutoff_at(_location_id uuid, _service_date date)
returns timestamp with time zone
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_timezone text;
  v_cutoff time;
begin
  select
    coalesce(co.timezone, 'Europe/Oslo'),
    coalesce(lp.cutoff_local_time, cc.default_cutoff_local_time, time '08:00')
  into v_timezone, v_cutoff
  from public.company_locations cl
  inner join public.companies co on co.id = cl.company_id
  left join public.location_policies lp
    on lp.location_id = cl.id
  left join lateral (
    select c.default_cutoff_local_time
    from public.company_contracts c
    where c.company_id = cl.company_id
      and c.is_active = true
      and c.valid_from <= _service_date
      and (c.valid_to is null or c.valid_to >= _service_date)
    order by c.valid_from desc
    limit 1
  ) cc on true
  where cl.id = _location_id;

  if v_timezone is null then
    raise exception 'Unknown location for cutoff calculation: %', _location_id;
  end if;

  return ((_service_date::text || ' ' || v_cutoff::text)::timestamp at time zone v_timezone);
end;
$function$;

create or replace function public.recalculate_order_totals(_order_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_company_id uuid;
  v_location_id uuid;
  v_service_date date;
  v_subtotal integer := 0;
  v_vat integer := 0;
  v_gross integer := 0;
  v_billing_mode public.billing_mode := 'company_pays_full';
  v_subsidy_default integer := 0;
  v_subsidy integer := 0;
  v_company_billable integer := 0;
  v_employee_payable integer := 0;
begin
  select o.company_id, o.location_id, o.service_date
  into v_company_id, v_location_id, v_service_date
  from public.orders o
  where o.id = _order_id;

  if v_company_id is null then
    raise exception 'Unknown order: %', _order_id;
  end if;

  select
    coalesce(sum(oi.line_subtotal_cents_ex_vat), 0),
    coalesce(sum(oi.line_vat_cents), 0),
    coalesce(sum(oi.line_total_cents_inc_vat), 0)
  into v_subtotal, v_vat, v_gross
  from public.order_items oi
  where oi.order_id = _order_id;

  select
    coalesce(lp.employee_subsidy_cents_inc_vat, cc.default_employee_subsidy_cents_inc_vat, 0),
    coalesce(cc.billing_mode, 'company_pays_full'::public.billing_mode)
  into v_subsidy_default, v_billing_mode
  from public.company_locations l
  left join public.location_policies lp
    on lp.location_id = l.id
  left join lateral (
    select c.default_employee_subsidy_cents_inc_vat, c.billing_mode
    from public.company_contracts c
    where c.company_id = l.company_id
      and c.is_active = true
      and c.valid_from <= v_service_date
      and (c.valid_to is null or c.valid_to >= v_service_date)
    order by c.valid_from desc
    limit 1
  ) cc on true
  where l.id = v_location_id;

  if v_billing_mode = 'company_pays_full' then
    v_subsidy := v_gross;
    v_company_billable := v_gross;
    v_employee_payable := 0;
  elsif v_billing_mode = 'employee_pays_full' then
    v_subsidy := 0;
    v_company_billable := 0;
    v_employee_payable := v_gross;
  else
    v_subsidy := least(v_subsidy_default, v_gross);
    v_company_billable := v_subsidy;
    v_employee_payable := greatest(v_gross - v_subsidy, 0);
  end if;

  update public.orders
  set subtotal_cents_ex_vat = v_subtotal,
      vat_cents = v_vat,
      gross_cents_inc_vat = v_gross,
      subsidy_cents_inc_vat = v_subsidy,
      company_billable_cents_inc_vat = v_company_billable,
      employee_payable_cents_inc_vat = v_employee_payable
  where id = _order_id;
end;
$function$;

create or replace function public.tg_menu_service_day_defaults()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_company_id uuid;
begin
  select l.company_id
  into v_company_id
  from public.company_locations l
  where l.id = new.location_id;

  if v_company_id is null then
    raise exception 'Unknown location: %', new.location_id;
  end if;

  new.company_id := v_company_id;
  new.cutoff_at := public.compute_cutoff_at(new.location_id, new.service_date);

  if exists (
    select 1
    from public.location_closed_dates lcd
    where lcd.location_id = new.location_id
      and lcd.closed_date = new.service_date
  ) then
    raise exception 'Location is closed on service date %', new.service_date;
  end if;

  if new.state = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  if new.state = 'locked' and new.locked_at is null then
    new.locked_at := now();
  end if;

  return new;
end;
$function$;

create or replace function public.tg_validate_membership_scope()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_company_id uuid;
begin
  if new.location_id is not null then
    select l.company_id
    into v_company_id
    from public.company_locations l
    where l.id = new.location_id;

    if v_company_id is null then
      raise exception 'Membership references unknown location: %', new.location_id;
    end if;

    if v_company_id <> new.company_id then
      raise exception 'Membership location must belong to the same company';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.tg_validate_standing_order_scope()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_location_company uuid;
  v_product_company uuid;
begin
  select l.company_id
  into v_location_company
  from public.company_locations l
  where l.id = new.location_id;

  if v_location_company is null then
    raise exception 'Unknown location: %', new.location_id;
  end if;

  if v_location_company <> new.company_id then
    raise exception 'Standing order company must match location company';
  end if;

  select p.company_id
  into v_product_company
  from public.products p
  where p.id = new.product_id
    and p.is_active = true
    and p.is_visible = true;

  if v_product_company is not null and v_product_company <> new.company_id then
    raise exception 'Standing order product belongs to another company';
  end if;

  return new;
end;
$function$;

--------------------------------------------------------------------------------
-- 3) Drop obsolete table (indexes and non-internal triggers on it drop with the table)
--------------------------------------------------------------------------------

drop table if exists public.locations;

--------------------------------------------------------------------------------
-- 4) Recreate FKs -> public.company_locations(id)
--------------------------------------------------------------------------------

alter table public.billing_adjustments
  add constraint billing_adjustments_location_id_fkey
  foreign key (location_id)
  references public.company_locations (id)
  on delete restrict;

alter table public.company_memberships
  add constraint company_memberships_location_id_fkey
  foreign key (location_id)
  references public.company_locations (id)
  on delete restrict;

alter table public.delivery_runs
  add constraint delivery_runs_location_id_fkey
  foreign key (location_id)
  references public.company_locations (id)
  on delete restrict;

alter table public.location_closed_dates
  add constraint location_closed_dates_location_id_fkey
  foreign key (location_id)
  references public.company_locations (id)
  on delete restrict;

alter table public.location_policies
  add constraint location_policies_location_id_fkey
  foreign key (location_id)
  references public.company_locations (id)
  on delete restrict;

alter table public.menu_service_days
  add constraint menu_service_days_location_id_fkey
  foreign key (location_id)
  references public.company_locations (id)
  on delete restrict;

alter table public.orders
  add constraint orders_location_id_fkey
  foreign key (location_id)
  references public.company_locations (id)
  on delete restrict;

alter table public.standing_orders
  add constraint standing_orders_location_id_fkey
  foreign key (location_id)
  references public.company_locations (id)
  on delete restrict;

commit;
