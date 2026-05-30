-- Staging/smoke: orders.provider_id is NOT NULL; lp_order_set inserts without it.
-- Hydrate from ACTIVE agreement (same row as agreement_id / tier).

begin;

create or replace function public.tg_orders_hydrate_core_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_agreement public.agreements%rowtype;
begin
  if new.company_id is null or new.location_id is null or new.date is null then
    return new;
  end if;

  if new.agreement_id is null then
    select a.*
    into v_agreement
    from public.agreements a
    where a.company_id = new.company_id
      and a.location_id = new.location_id
      and upper(a.status::text) = 'ACTIVE'
      and coalesce(a.starts_at, a.start_date) <= new.date
      and (a.ends_at is null or a.ends_at >= new.date)
    order by coalesce(a.starts_at, a.start_date) desc nulls last, a.created_at desc, a.id desc
    limit 1;

    if found then
      new.agreement_id := v_agreement.id;
    end if;
  else
    select a.*
    into v_agreement
    from public.agreements a
    where a.id = new.agreement_id;

    if not found then
      raise exception 'orders.agreement_id % does not exist', new.agreement_id;
    end if;
  end if;

  if v_agreement.id is null then
    raise exception 'No ACTIVE agreement could be resolved for orders(company_id %, location_id %, date %)', new.company_id, new.location_id, new.date;
  end if;

  if v_agreement.company_id <> new.company_id then
    raise exception 'orders.company_id must match agreements.company_id';
  end if;

  if v_agreement.location_id <> new.location_id then
    raise exception 'orders.location_id must match agreements.location_id';
  end if;

  if upper(v_agreement.status::text) <> 'ACTIVE' then
    raise exception 'orders must point to an ACTIVE agreement';
  end if;

  if new.date < coalesce(v_agreement.starts_at, v_agreement.start_date)
     or (v_agreement.ends_at is not null and new.date > v_agreement.ends_at) then
    raise exception 'orders.date is outside agreement period';
  end if;

  if new.tier is null then
    new.tier := v_agreement.tier;
  end if;

  if new.provider_id is null then
    new.provider_id := coalesce(
      v_agreement.provider_id,
      (select c.provider_id from public.companies c where c.id = new.company_id limit 1)
    );
  end if;

  if new.unit_price_nok is null then
    if upper(new.tier::text) = 'LUXUS' and v_agreement.price_per_meal_luxus_nok is not null then
      new.unit_price_nok := v_agreement.price_per_meal_luxus_nok;
    elsif upper(new.tier::text) = 'ENTERPRISE' and v_agreement.price_per_meal_enterprise_nok is not null then
      new.unit_price_nok := v_agreement.price_per_meal_enterprise_nok;
    else
      new.unit_price_nok := v_agreement.price_per_meal_nok;
    end if;
  end if;

  if new.unit_price_nok is null or new.unit_price_nok < 0 then
    raise exception 'orders.unit_price_nok must be >= 0';
  end if;

  if upper(new.status::text) = 'CANCELLED' and new.cancelled_at is null then
    new.cancelled_at := now();
  elsif upper(new.status::text) <> 'CANCELLED' then
    new.cancelled_at := null;
  end if;

  return new;
end;
$function$;

commit;
