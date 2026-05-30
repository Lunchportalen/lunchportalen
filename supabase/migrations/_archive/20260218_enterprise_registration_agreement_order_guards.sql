-- supabase/migrations/20260218_enterprise_registration_agreement_order_guards.sql
-- A+B+C enterprise-safe hardening:
-- A) Registration factual record + idempotent orgnr flow
-- B) Agreement lifecycle RPC (PENDING -> ACTIVE) with DB-level uniqueness
-- C) Authoritative lp_order_set guards + in-transaction outbox write

begin;

do $$
begin
  create type public.company_status as enum ('PENDING', 'ACTIVE', 'PAUSED', 'CLOSED');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.agreement_status as enum ('PENDING', 'ACTIVE', 'TERMINATED');
exception
  when duplicate_object then null;
end
$$;

-- Ensure TERMINATED exists for step1_4 assertion (bootstrap may have created PAUSED/CLOSED only).
do $$
begin
  alter type public.agreement_status add value if not exists 'TERMINATED';
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.agreement_tier as enum ('BASIS', 'LUXUS');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_status'
  ) then
    begin
      alter type public.order_status add value if not exists 'ACTIVE';
    exception
      when duplicate_object then null;
    end;

    begin
      alter type public.order_status add value if not exists 'CANCELLED';
    exception
      when duplicate_object then null;
    end;

    begin
      alter type public.order_status add value if not exists 'CANCELED';
    exception
      when duplicate_object then null;
    end;
  else
    create type public.order_status as enum ('ACTIVE', 'CANCELLED', 'CANCELED');
  end if;
end
$$;

alter table if exists public.companies
  add column if not exists orgnr text,
  add column if not exists name text,
  add column if not exists status public.company_status,
  add column if not exists employee_count integer,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists address text,
  add column if not exists address_line text,
  add column if not exists postal_code text,
  add column if not exists postal_city text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.companies
set status = coalesce(status, 'PENDING'::public.company_status)
where status is null;

alter table if exists public.outbox
  add column if not exists payload jsonb,
  add column if not exists next_retry_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.orders
  add column if not exists slot text not null default 'default';

do $$
begin
  if to_regclass('public.orders') is not null then
    execute 'create unique index if not exists orders_user_date_slot_uk on public.orders (user_id, date, slot)';
  end if;
end
$$;

-- =========================================================
-- A) Registration factual record on companies
-- =========================================================
alter table public.companies
  add column if not exists orgnr text,
  add column if not exists name text,
  add column if not exists status public.company_status,
  add column if not exists employee_count integer,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists address text,
  add column if not exists address_line text,
  add column if not exists postal_code text,
  add column if not exists postal_city text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.companies
set
  address_line = coalesce(nullif(address_line, ''), nullif(address, '')),
  address = coalesce(nullif(address, ''), nullif(address_line, '')),
  postal_code = nullif(regexp_replace(coalesce(postal_code, ''), '\D', '', 'g'), ''),
  postal_city = nullif(btrim(coalesce(postal_city, '')), '')
where
  address_line is null
  or address is null
  or postal_code is null
  or postal_city is null;

alter table public.companies
  drop constraint if exists companies_employee_count_min_ck;

alter table public.companies
  add constraint companies_employee_count_min_ck
  check (employee_count is null or employee_count >= 20) not valid;

alter table public.companies
  drop constraint if exists companies_postal_code_format_ck;

alter table public.companies
  add constraint companies_postal_code_format_ck
  check (postal_code is null or postal_code ~ '^[0-9]{4}$') not valid;

alter table public.companies
  drop constraint if exists companies_pending_registration_fields_ck;

alter table public.companies
  add constraint companies_pending_registration_fields_ck
  check (
    status <> 'PENDING'::public.company_status
    or (
      employee_count is not null
      and employee_count >= 20
      and contact_name is not null
      and btrim(contact_name) <> ''
      and contact_email is not null
      and btrim(contact_email) <> ''
      and contact_phone is not null
      and btrim(contact_phone) <> ''
      and address_line is not null
      and btrim(address_line) <> ''
      and postal_code is not null
      and postal_code ~ '^[0-9]{4}$'
      and postal_city is not null
      and btrim(postal_city) <> ''
    )
  ) not valid;

create unique index if not exists companies_orgnr_unique_not_null
  on public.companies (orgnr)
  where orgnr is not null;

create unique index if not exists outbox_event_key_uniq
  on public.outbox (event_key);

alter table public.outbox
  add column if not exists payload jsonb,
  add column if not exists next_retry_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

drop function if exists public.lp_company_register(
  text,
  text,
  text,
  text,
  integer,
  text,
  text
);

drop function if exists public.lp_company_register(
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
);

create or replace function public.lp_company_register(
  p_orgnr text,
  p_company_name text,
  p_employee_count integer,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_address_line text,
  p_postal_code text,
  p_postal_city text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_company_id uuid;
  v_status public.company_status;
  v_now timestamptz := clock_timestamp();

  v_orgnr text := regexp_replace(btrim(coalesce(p_orgnr, '')), '\D', '', 'g');
  v_company_name text := btrim(coalesce(p_company_name, ''));
  v_contact_name text := btrim(coalesce(p_contact_name, ''));
  v_contact_email text := lower(btrim(coalesce(p_contact_email, '')));
  v_contact_phone text := btrim(coalesce(p_contact_phone, ''));
  v_address_line text := btrim(coalesce(p_address_line, ''));
  v_postal_code text := regexp_replace(btrim(coalesce(p_postal_code, '')), '\D', '', 'g');
  v_postal_city text := btrim(coalesce(p_postal_city, ''));
begin
  if length(v_orgnr) <> 9 then
    raise exception using errcode = 'P0001', message = 'ORGNR_INVALID';
  end if;

  if v_company_name = '' then
    raise exception using errcode = 'P0001', message = 'COMPANY_NAME_REQUIRED';
  end if;

  if p_employee_count is null or p_employee_count < 20 then
    raise exception using errcode = 'P0001', message = 'EMPLOYEE_COUNT_MIN_20';
  end if;

  if v_contact_name = '' then
    raise exception using errcode = 'P0001', message = 'CONTACT_NAME_REQUIRED';
  end if;

  if v_contact_email = '' then
    raise exception using errcode = 'P0001', message = 'CONTACT_EMAIL_REQUIRED';
  end if;

  if not (v_contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception using errcode = 'P0001', message = 'CONTACT_EMAIL_INVALID';
  end if;

  if v_contact_phone = '' then
    raise exception using errcode = 'P0001', message = 'CONTACT_PHONE_REQUIRED';
  end if;

  if v_address_line = '' then
    raise exception using errcode = 'P0001', message = 'ADDRESS_LINE_REQUIRED';
  end if;

  if v_postal_code !~ '^[0-9]{4}$' then
    raise exception using errcode = 'P0001', message = 'POSTAL_CODE_INVALID';
  end if;

  if v_postal_city = '' then
    raise exception using errcode = 'P0001', message = 'POSTAL_CITY_REQUIRED';
  end if;

  select c.id, c.status
    into v_company_id, v_status
  from public.companies c
  where c.orgnr = v_orgnr
  limit 1
  for update;

  if v_company_id is null then
    insert into public.companies (
      orgnr,
      name,
      status,
      employee_count,
      contact_name,
      contact_email,
      contact_phone,
      address,
      address_line,
      postal_code,
      postal_city
    )
    values (
      v_orgnr,
      v_company_name,
      'PENDING'::public.company_status,
      p_employee_count,
      v_contact_name,
      v_contact_email,
      v_contact_phone,
      v_address_line,
      v_address_line,
      v_postal_code,
      v_postal_city
    )
    returning id, status
      into v_company_id, v_status;
  else
    update public.companies c
       set
         name = case
           when (c.name is null or btrim(c.name) = '') and v_company_name <> '' then v_company_name
           else c.name
         end,
         employee_count = case
           when c.employee_count is null then p_employee_count
           else c.employee_count
         end,
         contact_name = case
           when (c.contact_name is null or btrim(c.contact_name) = '') and v_contact_name <> '' then v_contact_name
           else c.contact_name
         end,
         contact_email = case
           when (c.contact_email is null or btrim(c.contact_email) = '') and v_contact_email <> '' then v_contact_email
           else c.contact_email
         end,
         contact_phone = case
           when (c.contact_phone is null or btrim(c.contact_phone) = '') and v_contact_phone <> '' then v_contact_phone
           else c.contact_phone
         end,
         address_line = case
           when (c.address_line is null or btrim(c.address_line) = '') and v_address_line <> '' then v_address_line
           else c.address_line
         end,
         address = case
           when (c.address is null or btrim(c.address) = '') and v_address_line <> '' then v_address_line
           else c.address
         end,
         postal_code = case
           when (c.postal_code is null or btrim(c.postal_code) = '') and v_postal_code <> '' then v_postal_code
           else c.postal_code
         end,
         postal_city = case
           when (c.postal_city is null or btrim(c.postal_city) = '') and v_postal_city <> '' then v_postal_city
           else c.postal_city
         end,
         updated_at = now()
     where c.id = v_company_id
     returning status into v_status;
  end if;

  insert into public.outbox (
    event_key,
    payload,
    status,
    attempts,
    last_error,
    locked_at,
    locked_by,
    next_retry_at,
    delivered_at
  )
  values (
    format('company.registered:%s', v_company_id::text),
    jsonb_build_object(
      'event', 'company.registered',
      'companyId', v_company_id,
      'orgnr', v_orgnr,
      'companyName', v_company_name,
      'employeeCount', p_employee_count,
      'contactName', v_contact_name,
      'contactEmail', v_contact_email,
      'contactPhone', v_contact_phone,
      'addressLine', v_address_line,
      'postalCode', v_postal_code,
      'postalCity', v_postal_city,
      'receipt', v_now
    ),
    'PENDING',
    0,
    null,
    null,
    null,
    null,
    null
  )
  on conflict (event_key) do nothing;

  return jsonb_build_object(
    'company_id', v_company_id,
    'status', v_status,
    'receipt', v_now
  );
end
$$;

revoke all on function public.lp_company_register(
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
) from public;
revoke all on function public.lp_company_register(
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
) from anon;
revoke all on function public.lp_company_register(
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
) from authenticated;
grant execute on function public.lp_company_register(
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;
grant execute on function public.lp_company_register(
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
) to postgres;

-- =========================================================
-- B) Agreement lifecycle RPCs
-- =========================================================
alter table public.agreements
  add column if not exists binding_months integer,
  add column if not exists notice_months integer,
  add column if not exists price_per_employee numeric(10,2);

alter table public.agreements
  alter column binding_months set default 12;

alter table public.agreements
  alter column notice_months set default 3;

update public.agreements
set
  binding_months = coalesce(binding_months, 12),
  notice_months = coalesce(notice_months, 3)
where binding_months is null or notice_months is null;

alter table public.agreements
  drop constraint if exists agreements_binding_months_ck;

alter table public.agreements
  add constraint agreements_binding_months_ck
  check (binding_months is null or binding_months > 0) not valid;

alter table public.agreements
  drop constraint if exists agreements_notice_months_ck;

alter table public.agreements
  add constraint agreements_notice_months_ck
  check (notice_months is null or notice_months >= 0) not valid;

alter table public.agreements
  drop constraint if exists agreements_price_per_employee_ck;

alter table public.agreements
  add constraint agreements_price_per_employee_ck
  check (price_per_employee is null or price_per_employee > 0) not valid;

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

  select c.id
    into v_company_id
  from public.companies c
  where c.id = p_company_id
  for update;

  if v_company_id is null then
    raise exception using errcode = 'P0002', message = 'COMPANY_NOT_FOUND';
  end if;

  if p_location_id is null then
    select cl.id
      into v_location_id
    from public.company_locations cl
    where cl.company_id = p_company_id
    order by cl.created_at asc
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

  if v_agreement.status <> 'PENDING'::public.agreement_status then
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

  update public.agreements
     set status = 'ACTIVE'::public.agreement_status,
         updated_at = now()
   where id = v_agreement.id;

  if v_company_status in ('PENDING'::public.company_status, 'PAUSED'::public.company_status) then
    update public.companies
       set status = 'ACTIVE'::public.company_status,
           updated_at = now()
     where id = v_agreement.company_id;
  end if;

  insert into public.outbox (
    event_key,
    payload,
    status,
    attempts,
    last_error,
    locked_at,
    locked_by,
    next_retry_at,
    delivered_at
  )
  values (
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
    null,
    null,
    null
  )
  on conflict (event_key) do nothing;

  insert into public.outbox (
    event_key,
    payload,
    status,
    attempts,
    last_error,
    locked_at,
    locked_by,
    next_retry_at,
    delivered_at
  )
  values (
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
    null,
    null,
    null
  )
  on conflict (event_key) do nothing;

  return jsonb_build_object(
    'agreement_id', v_agreement.id,
    'company_id', v_agreement.company_id,
    'status', 'ACTIVE',
    'receipt', v_now
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'ACTIVE_AGREEMENT_EXISTS';
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

-- =========================================================
-- C) Authoritative lp_order_set with explicit scope
-- =========================================================
drop function if exists public.lp_order_set(
  uuid,
  uuid,
  uuid,
  date,
  text,
  text,
  text
);

create or replace function public.lp_order_set(
  p_user_id uuid,
  p_company_id uuid,
  p_location_id uuid,
  p_date date,
  p_action text,
  p_note text default null,
  p_slot text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_actor_uid uuid := auth.uid();
  v_profile_company_id uuid;
  v_profile_location_id uuid;
  v_agreement public.agreements%rowtype;

  v_action text := upper(trim(coalesce(p_action, '')));
  v_slot text := coalesce(nullif(trim(coalesce(p_slot, '')), ''), 'default');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_db_status text;

  v_oslo_now timestamptz := timezone('Europe/Oslo', now());
  v_oslo_today date := (timezone('Europe/Oslo', now()))::date;
  v_oslo_time time := (timezone('Europe/Oslo', now()))::time;
  v_cutoff_passed boolean := false;

  v_isodow int;
  v_day_key text;
  v_order_id uuid;
  v_saved_status text;
  v_receipt timestamptz := clock_timestamp();
  v_rid text := format('rid_%s', replace(gen_random_uuid()::text, '-', ''));
  v_changed boolean := false;
begin
  if v_actor_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  if p_user_id is null or p_company_id is null or p_location_id is null then
    raise exception using errcode = 'P0001', message = 'SCOPE_REQUIRED';
  end if;

  if p_user_id <> v_actor_uid then
    raise exception using errcode = 'P0001', message = 'SCOPE_FORBIDDEN';
  end if;

  if p_date is null then
    raise exception using errcode = 'P0001', message = 'DATE_REQUIRED';
  end if;

  if v_action in ('ORDER', 'SET', 'PLACE') then
    v_action := 'SET';
  elsif v_action = 'CANCEL' then
    v_action := 'CANCEL';
  else
    raise exception using errcode = 'P0001', message = 'ACTION_INVALID';
  end if;

  select p.company_id, p.location_id
    into v_profile_company_id, v_profile_location_id
  from public.profiles p
  where p.id = p_user_id
  order by p.updated_at desc
  limit 1;

  if v_profile_company_id is null or v_profile_location_id is null then
    raise exception using errcode = 'P0001', message = 'PROFILE_MISSING';
  end if;

  if v_profile_company_id <> p_company_id or v_profile_location_id <> p_location_id then
    raise exception using errcode = 'P0001', message = 'SCOPE_FORBIDDEN';
  end if;

  if p_date < v_oslo_today then
    v_cutoff_passed := true;
  elsif p_date = v_oslo_today and v_oslo_time >= time '08:00' then
    v_cutoff_passed := true;
  end if;

  if v_cutoff_passed then
    raise exception using errcode = 'P0001', message = 'CUTOFF_PASSED';
  end if;

  select a.*
    into v_agreement
  from public.agreements a
  where a.company_id = p_company_id
    and a.location_id = p_location_id
    and upper(a.status::text) = 'ACTIVE'
  order by coalesce(a.starts_at, '-infinity'::date) desc, a.updated_at desc
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'NO_ACTIVE_AGREEMENT';
  end if;

  if v_agreement.starts_at is not null and p_date < v_agreement.starts_at::date then
    raise exception using errcode = 'P0001', message = 'NO_ACTIVE_AGREEMENT';
  end if;

  v_isodow := extract(isodow from p_date)::int;
  v_day_key := case v_isodow
    when 1 then 'mon'
    when 2 then 'tue'
    when 3 then 'wed'
    when 4 then 'thu'
    when 5 then 'fri'
    else null
  end;

  if v_day_key is null then
    raise exception using errcode = 'P0001', message = 'OUTSIDE_DELIVERY_DAYS';
  end if;

  if not (
    (
      jsonb_typeof(v_agreement.delivery_days) = 'array'
      and exists (
        select 1
        from jsonb_array_elements(v_agreement.delivery_days) as d(v)
        where (
          jsonb_typeof(d.v) = 'string'
          and lower(trim(both '"' from d.v::text)) in (v_day_key, v_isodow::text)
        )
        or (
          jsonb_typeof(d.v) = 'number'
          and regexp_replace(d.v::text, '\s', '', 'g') = v_isodow::text
        )
      )
    )
    or
    (
      jsonb_typeof(v_agreement.delivery_days) = 'object'
      and (
        v_agreement.delivery_days ? v_day_key
        or v_agreement.delivery_days ? v_isodow::text
      )
    )
    or
    (
      jsonb_typeof(v_agreement.delivery_days) = 'string'
      and exists (
        select 1
        from regexp_split_to_table(
          lower(trim(both '"' from v_agreement.delivery_days::text)),
          '[,\s]+'
        ) as token(v)
        where token.v in (v_day_key, v_isodow::text)
      )
    )
  ) then
    raise exception using errcode = 'P0001', message = 'OUTSIDE_DELIVERY_DAYS';
  end if;

  v_db_status := case
    when v_action = 'SET' then 'ACTIVE'
    else 'CANCELLED'
  end;

  insert into public.orders (
    user_id,
    company_id,
    location_id,
    date,
    slot,
    status,
    note,
    updated_at
  )
  values (
    p_user_id,
    p_company_id,
    p_location_id,
    p_date,
    v_slot,
    v_db_status::public.order_status,
    case when v_action = 'SET' then v_note else null end,
    now()
  )
  on conflict (user_id, date, slot)
  do update set
    company_id = excluded.company_id,
    location_id = excluded.location_id,
    status = excluded.status,
    note = excluded.note,
    updated_at = now()
  where
    public.orders.company_id is distinct from excluded.company_id
    or public.orders.location_id is distinct from excluded.location_id
    or public.orders.status is distinct from excluded.status
    or public.orders.note is distinct from excluded.note
  returning id, status::text into v_order_id, v_saved_status;

  if v_order_id is null then
    select o.id, o.status::text
      into v_order_id, v_saved_status
    from public.orders o
    where o.user_id = p_user_id
      and o.company_id = p_company_id
      and o.location_id = p_location_id
      and o.date = p_date
      and o.slot = v_slot
    limit 1;
    v_changed := false;
  else
    v_changed := true;
  end if;

  if v_changed then
    insert into public.outbox (
      event_key,
      payload,
      status,
      attempts,
      last_error,
      locked_at,
      locked_by,
      next_retry_at,
      delivered_at,
      updated_at
    )
    values (
      format('order.changed:%s', v_order_id::text),
      jsonb_build_object(
        'event', 'order.changed',
        'action', v_action,
        'orderId', v_order_id,
        'companyId', p_company_id,
        'locationId', p_location_id,
        'userId', p_user_id,
        'date', p_date,
        'slot', v_slot,
        'status', upper(v_saved_status),
        'receipt', v_receipt,
        'rid', v_rid
      ),
      'PENDING',
      0,
      null,
      null,
      null,
      null,
      null,
      now()
    )
    on conflict (event_key) do update
      set payload = excluded.payload,
          status = 'PENDING',
          attempts = 0,
          last_error = null,
          locked_at = null,
          locked_by = null,
          next_retry_at = null,
          delivered_at = null,
          updated_at = now();
  else
    insert into public.outbox (
      event_key,
      payload,
      status,
      attempts,
      last_error,
      locked_at,
      locked_by,
      next_retry_at,
      delivered_at,
      updated_at
    )
    values (
      format('order.changed:%s', v_order_id::text),
      jsonb_build_object(
        'event', 'order.changed',
        'action', v_action,
        'orderId', v_order_id,
        'companyId', p_company_id,
        'locationId', p_location_id,
        'userId', p_user_id,
        'date', p_date,
        'slot', v_slot,
        'status', upper(v_saved_status),
        'receipt', v_receipt,
        'rid', v_rid
      ),
      'PENDING',
      0,
      null,
      null,
      null,
      null,
      null,
      now()
    )
    on conflict (event_key) do nothing;
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'status', upper(v_saved_status),
    'company_id', p_company_id,
    'location_id', p_location_id,
    'date', p_date,
    'slot', v_slot,
    'receipt', v_receipt,
    'cutoff_passed', false,
    'rid', v_rid
  );
end
$$;

drop function if exists public.lp_order_set(date, text, text, text);
drop function if exists public.lp_order_set(date, text, text);
drop function if exists public.lp_order_set(date, text);

create or replace function public.lp_order_set(
  p_date date,
  p_action text,
  p_note text default null,
  p_slot text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_location_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select p.company_id, p.location_id
    into v_company_id, v_location_id
  from public.profiles p
  where p.id = v_uid
  order by p.updated_at desc
  limit 1;

  if v_company_id is null or v_location_id is null then
    raise exception using errcode = 'P0001', message = 'PROFILE_MISSING';
  end if;

  return public.lp_order_set(
    v_uid,
    v_company_id,
    v_location_id,
    p_date,
    p_action,
    p_note,
    p_slot
  );
end
$$;

revoke all on function public.lp_order_set(
  uuid,
  uuid,
  uuid,
  date,
  text,
  text,
  text
) from public;
revoke all on function public.lp_order_set(
  uuid,
  uuid,
  uuid,
  date,
  text,
  text,
  text
) from anon;
grant execute on function public.lp_order_set(
  uuid,
  uuid,
  uuid,
  date,
  text,
  text,
  text
) to authenticated;
grant execute on function public.lp_order_set(
  uuid,
  uuid,
  uuid,
  date,
  text,
  text,
  text
) to service_role;
grant execute on function public.lp_order_set(
  uuid,
  uuid,
  uuid,
  date,
  text,
  text,
  text
) to postgres;

revoke all on function public.lp_order_set(date, text, text, text) from public;
revoke all on function public.lp_order_set(date, text, text, text) from anon;
grant execute on function public.lp_order_set(date, text, text, text) to authenticated;
grant execute on function public.lp_order_set(date, text, text, text) to service_role;
grant execute on function public.lp_order_set(date, text, text, text) to postgres;

commit;




