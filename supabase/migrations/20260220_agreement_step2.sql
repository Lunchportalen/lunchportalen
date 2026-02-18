-- supabase/migrations/20260220_agreement_step2.sql
-- TRINN 2: Avtaleflyt PENDING -> ACTIVE, DB-lås og atomisk approve

begin;

-- Fail-closed: agreements.status must be public.agreement_status before partial index.
do $$
declare
  v_status_type text;
begin
  if to_regclass('public.agreements') is null then
    raise exception 'required table missing: public.agreements';
  end if;

  select format('%I.%I', n.nspname, t.typname)
    into v_status_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace cn on cn.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  join pg_namespace n on n.oid = t.typnamespace
  where cn.nspname = 'public'
    and c.relname = 'agreements'
    and a.attname = 'status'
    and a.attnum > 0
    and not a.attisdropped;

  if v_status_type is null then
    raise exception 'agreements.status column missing';
  end if;

  if v_status_type <> 'public.agreement_status' then
    raise exception 'agreements.status type mismatch: expected public.agreement_status, got %', v_status_type;
  end if;
end
$$;

do $$
begin
  begin
    alter type public.agreement_status add value if not exists 'TERMINATED';
  exception
    when duplicate_object then null;
  end;
end
$$;

alter table public.agreements
  add column if not exists binding_months integer,
  add column if not exists notice_months integer,
  add column if not exists price_per_employee numeric(10,2);

alter table public.agreements
  alter column binding_months set default 12,
  alter column notice_months set default 3;

update public.agreements
set
  binding_months = coalesce(binding_months, 12),
  notice_months = coalesce(notice_months, 3)
where binding_months is null
   or notice_months is null;

alter table public.agreements
  drop constraint if exists agreements_binding_months_ck;
alter table public.agreements
  add constraint agreements_binding_months_ck
  check (binding_months is null or binding_months > 0);

alter table public.agreements
  drop constraint if exists agreements_notice_months_ck;
alter table public.agreements
  add constraint agreements_notice_months_ck
  check (notice_months is null or notice_months >= 0);

alter table public.agreements
  drop constraint if exists agreements_price_per_employee_ck;
alter table public.agreements
  add constraint agreements_price_per_employee_ck
  check (price_per_employee is null or price_per_employee > 0);

create unique index if not exists agreements_one_active_per_company_uk
  on public.agreements (company_id)
  where status = 'ACTIVE'::public.agreement_status;

drop function if exists public.lp_agreement_create_pending(
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
);

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

  if v_tier not in ('BASIS', 'LUXUS') then
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

  return jsonb_build_object(
    'agreement_id', v_agreement_id,
    'company_id', p_company_id,
    'status', 'PENDING'
  );
end
$$;

drop function if exists public.lp_agreement_approve_active(uuid, uuid);

create or replace function public.lp_agreement_approve_active(
  p_agreement_id uuid,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_agreement public.agreements%rowtype;
  v_company_status public.company_status;
  v_now timestamptz := clock_timestamp();
begin
  if p_agreement_id is null then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_ID_REQUIRED';
  end if;

  select a.*
    into v_agreement
  from public.agreements a
  where a.id = p_agreement_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'AGREEMENT_NOT_FOUND';
  end if;

  if upper(v_agreement.status::text) <> 'PENDING' then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_NOT_PENDING';
  end if;

  select c.status
    into v_company_status
  from public.companies c
  where c.id = v_agreement.company_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'COMPANY_NOT_FOUND';
  end if;

  if v_company_status = 'CLOSED'::public.company_status then
    raise exception using errcode = 'P0001', message = 'COMPANY_CLOSED';
  end if;

  if exists (
    select 1
    from public.agreements a
    where a.company_id = v_agreement.company_id
      and a.id <> v_agreement.id
      and upper(a.status::text) = 'ACTIVE'
    for update
  ) then
    raise exception using errcode = '23505', message = 'ACTIVE_AGREEMENT_EXISTS';
  end if;

  update public.agreements
     set status = 'ACTIVE'::public.agreement_status,
         updated_at = now()
   where id = v_agreement.id;

  if v_company_status <> 'ACTIVE'::public.company_status then
    update public.companies
       set status = 'ACTIVE'::public.company_status,
           updated_at = now()
     where id = v_agreement.company_id;
  end if;

  if to_regclass('public.outbox') is null then
    raise exception using errcode = 'P0001', message = 'OUTBOX_MISSING';
  end if;

  execute '
    insert into public.outbox (event_key, payload, status, attempts, last_error, locked_at, locked_by)
    values ($1, $2, $3, $4, $5, $6, $7)
    on conflict (event_key) do nothing
  '
    using
      format('agreement.activated:%s', v_agreement.id::text),
      jsonb_build_object(
        'event', 'agreement.activated',
        'agreementId', v_agreement.id,
        'companyId', v_agreement.company_id,
        'actorUserId', p_actor_user_id,
        'receipt', v_now
      ),
      'PENDING',
      0,
      null,
      null,
      null;

  execute '
    insert into public.outbox (event_key, payload, status, attempts, last_error, locked_at, locked_by)
    values ($1, $2, $3, $4, $5, $6, $7)
    on conflict (event_key) do nothing
  '
    using
      format('company.activated:%s', v_agreement.company_id::text),
      jsonb_build_object(
        'event', 'company.activated',
        'agreementId', v_agreement.id,
        'companyId', v_agreement.company_id,
        'actorUserId', p_actor_user_id,
        'receipt', v_now
      ),
      'PENDING',
      0,
      null,
      null,
      null;

  return jsonb_build_object(
    'agreement_id', v_agreement.id,
    'company_id', v_agreement.company_id,
    'status', 'ACTIVE',
    'receipt', v_now
  );
end
$$;

create or replace function public.lp_agreement_approve(
  p_agreement_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  return public.lp_agreement_approve_active(p_agreement_id, auth.uid());
end
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

revoke all on function public.lp_agreement_approve_active(uuid, uuid) from public;
revoke all on function public.lp_agreement_approve_active(uuid, uuid) from anon;
revoke all on function public.lp_agreement_approve_active(uuid, uuid) from authenticated;
grant execute on function public.lp_agreement_approve_active(uuid, uuid) to service_role;
grant execute on function public.lp_agreement_approve_active(uuid, uuid) to postgres;

revoke all on function public.lp_agreement_approve(uuid) from public;
revoke all on function public.lp_agreement_approve(uuid) from anon;
revoke all on function public.lp_agreement_approve(uuid) from authenticated;
grant execute on function public.lp_agreement_approve(uuid) to service_role;
grant execute on function public.lp_agreement_approve(uuid) to postgres;

commit;