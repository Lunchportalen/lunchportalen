-- FASE 10C.3-PHASE-7: Derive service_date from date when RPC omits it (lp_order_set sets date only).
-- STOPS "Orders require location_id and service_date" for valid inserts with location_id + date.

CREATE OR REPLACE FUNCTION public.tg_order_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
declare
  v_menu_day_id uuid;
  v_company_id uuid;
  v_state public.menu_state;
  v_cutoff timestamptz;
begin
  -- Routine updates should not re-derive menu/company/cutoff when the
  -- order identity is unchanged. This keeps historical/legacy rows editable
  -- for non-identity fields (status, notes, totals, etc.).
  if tg_op = 'UPDATE'
     and new.location_id is not distinct from old.location_id
     and new.service_date is not distinct from old.service_date
     and new.menu_service_day_id is not distinct from old.menu_service_day_id
     and new.company_id is not distinct from old.company_id
     and new.cutoff_at is not distinct from old.cutoff_at
  then
    if new.currency_code is null then
      new.currency_code := coalesce(old.currency_code, 'NOK');
    end if;
    return new;
  end if;

  -- Derive service_date from date FIRST so INSERT past-check compares a real value.
  new.service_date := coalesce(new.service_date, new.date);

  if tg_op = 'INSERT'
     and new.service_date < current_date
     and not (
       select private.has_platform_role(array[
         'platform_admin'::public.platform_role,
         'platform_ops'::public.platform_role
       ])
     )
  then
    raise exception 'Orders cannot be created for past service dates';
  end if;

  if new.location_id is null or new.service_date is null then
    raise exception 'Orders require location_id and service_date';
  end if;

  select
    msd.id,
    msd.company_id,
    msd.state,
    msd.cutoff_at
  into v_menu_day_id, v_company_id, v_state, v_cutoff
  from public.menu_service_days msd
  where msd.location_id = new.location_id
    and msd.service_date = new.service_date
  limit 1;

  if v_menu_day_id is null then
    raise exception 'No menu exists for location % on %', new.location_id, new.service_date;
  end if;

  if v_state not in ('published', 'locked')
     and not (select private.can_manage_location(new.location_id))
     and not (
       select private.has_platform_role(array[
         'platform_admin'::public.platform_role,
         'platform_ops'::public.platform_role
       ])
     )
  then
    raise exception 'Menu is not published for this service day';
  end if;

  new.menu_service_day_id := v_menu_day_id;
  new.company_id := v_company_id;
  new.cutoff_at := v_cutoff;

  if new.currency_code is null then
    new.currency_code := 'NOK';
  end if;

  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;

  return new;
end;
$function$;
