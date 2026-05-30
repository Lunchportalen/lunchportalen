-- Oppdater lp_agreement_create_pending til å akseptere ENTERPRISE.
-- Replikerer nyeste eksisterende funksjon fra 20260414220000_agreement_day_slot_rules_daymap.sql
-- med kun whitelist-endring fra ('BASIS', 'LUXUS') til ('BASIS', 'LUXUS', 'ENTERPRISE').

create or replace function public.lp_agreement_create_pending(
  p_company_id uuid,
  p_location_id uuid default null,
  p_tier text default 'BASIS',
  p_delivery_days jsonb default '["mon","tue","wed","thu","fri"]'::jsonb,
  p_slot_start time default time '11:00',
  p_slot_end time default time '13:00',
  p_starts_at date default null,
  p_binding_months integer default 12,
  p_notice_months integer default 3,
  p_price_per_employee numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_company_id uuid;
  v_location_id uuid;
  v_company_status public.company_status;
  v_tier text := upper(trim(coalesce(p_tier, '')));
  v_binding integer := coalesce(p_binding_months, 12);
  v_notice integer := coalesce(p_notice_months, 3);
  v_price numeric := p_price_per_employee;
  v_delivery jsonb := coalesce(p_delivery_days, '[]'::jsonb);
  v_days text[];
  v_agreement_id uuid;
begin
  if p_company_id is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_ID_REQUIRED';
  end if;

  select c.id, c.status
    into v_company_id, v_company_status
  from public.companies c
  where c.id = p_company_id
  for update;

  if v_company_id is null then
    raise exception using errcode = 'P0002', message = 'COMPANY_NOT_FOUND';
  end if;

  if v_company_status = 'CLOSED'::public.company_status then
    raise exception using errcode = 'P0001', message = 'COMPANY_CLOSED';
  end if;

  if exists (
    select 1
    from public.agreements a
    where a.company_id = p_company_id
      and upper(a.status::text) = 'PENDING'
  ) then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_PENDING_EXISTS';
  end if;

  if p_location_id is null then
    select cl.id
      into v_location_id
    from public.company_locations cl
    where cl.company_id = p_company_id
    order by cl.id asc
    limit 1;

    if v_location_id is null then
      raise exception using errcode = 'P0001', message = 'LOCATION_REQUIRED';
    end if;
  else
    select cl.id
      into v_location_id
    from public.company_locations cl
    where cl.id = p_location_id
      and cl.company_id = p_company_id
    limit 1;

    if v_location_id is null then
      raise exception using errcode = 'P0001', message = 'LOCATION_INVALID';
    end if;
  end if;

  if v_tier not in ('BASIS', 'LUXUS', 'ENTERPRISE') then
    raise exception using errcode = 'P0001', message = 'TIER_INVALID';
  end if;

  if p_starts_at is null then
    raise exception using errcode = 'P0001', message = 'STARTS_AT_REQUIRED';
  end if;

  if p_slot_start is null or p_slot_end is null or p_slot_start >= p_slot_end then
    raise exception using errcode = 'P0001', message = 'SLOT_RANGE_INVALID';
  end if;

  if v_binding <= 0 then
    raise exception using errcode = 'P0001', message = 'BINDING_MONTHS_INVALID';
  end if;

  if v_notice < 0 then
    raise exception using errcode = 'P0001', message = 'NOTICE_MONTHS_INVALID';
  end if;

  if v_price is null or v_price <= 0 then
    raise exception using errcode = 'P0001', message = 'PRICE_PER_EMPLOYEE_INVALID';
  end if;

  if jsonb_typeof(v_delivery) <> 'array' then
    raise exception using errcode = 'P0001', message = 'DELIVERY_DAYS_INVALID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_delivery) d(v)
    where lower(trim(d.v)) not in ('mon', 'tue', 'wed', 'thu', 'fri')
  ) then
    raise exception using errcode = 'P0001', message = 'DELIVERY_DAYS_INVALID';
  end if;

  select array_agg(day_key order by ord)
    into v_days
  from (
    select distinct
      case lower(trim(d.v))
        when 'mon' then 'mon'
        when 'tue' then 'tue'
        when 'wed' then 'wed'
        when 'thu' then 'thu'
        when 'fri' then 'fri'
      end as day_key,
      case lower(trim(d.v))
        when 'mon' then 1
        when 'tue' then 2
        when 'wed' then 3
        when 'thu' then 4
        when 'fri' then 5
      end as ord
    from jsonb_array_elements_text(v_delivery) d(v)
  ) x
  where day_key is not null;

  if coalesce(array_length(v_days, 1), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'DELIVERY_DAYS_REQUIRED';
  end if;

  insert into public.agreements (
    company_id,
    location_id,
    tier,
    status,
    delivery_days,
    slot_start,
    slot_end,
    starts_at,
    binding_months,
    notice_months,
    price_per_employee
  )
  values (
    p_company_id,
    v_location_id,
    v_tier::public.agreement_tier,
    'PENDING'::public.agreement_status,
    to_jsonb(v_days),
    p_slot_start,
    p_slot_end,
    p_starts_at,
    v_binding,
    v_notice,
    v_price
  )
  returning id into v_agreement_id;

  perform public.lp_materialize_agreement_day_slots(p_company_id, v_agreement_id);

  return jsonb_build_object(
    'agreement_id', v_agreement_id,
    'company_id', p_company_id,
    'status', 'PENDING'
  );
end;
$$;

revoke all on function public.lp_agreement_create_pending(
  uuid,
  uuid,
  text,
  jsonb,
  time,
  time,
  date,
  integer,
  integer,
  numeric
) from public;
revoke all on function public.lp_agreement_create_pending(
  uuid,
  uuid,
  text,
  jsonb,
  time,
  time,
  date,
  integer,
  integer,
  numeric
) from anon;
revoke all on function public.lp_agreement_create_pending(
  uuid,
  uuid,
  text,
  jsonb,
  time,
  time,
  date,
  integer,
  integer,
  numeric
) from authenticated;
grant execute on function public.lp_agreement_create_pending(
  uuid,
  uuid,
  text,
  jsonb,
  time,
  time,
  date,
  integer,
  integer,
  numeric
) to service_role;
grant execute on function public.lp_agreement_create_pending(
  uuid,
  uuid,
  text,
  jsonb,
  time,
  time,
  date,
  integer,
  integer,
  numeric
) to postgres;
