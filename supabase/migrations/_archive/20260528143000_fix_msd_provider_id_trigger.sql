-- Root cause: 20260520160001_seed_default_provider_melhus.sql added provider_id NOT NULL
-- on menu_service_days without updating tg_menu_service_day_defaults or sync INSERT paths.
-- New MSD rows from reconcile/webhook upsert failed with 23502 until provider_id was set.
--
-- Fix: preserve live trigger logic (company_id, cutoff_at, closed-date, published_at, locked_at)
-- and derive provider_id from company_locations → companies.provider_id before INSERT/UPDATE.

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

  if new.provider_id is null then
    select c.provider_id into new.provider_id
    from public.company_locations l
    join public.companies c on c.id = l.company_id
    where l.id = new.location_id;
  end if;

  if new.provider_id is null then
    raise exception
      'MSD_PROVIDER_UNRESOLVABLE: location_id=% har ingen provider via company',
      new.location_id
      using errcode = 'check_violation', hint = 'msd_provider';
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
